import {
  PRODUCT_EMBEDDING_LOCAL_DEFAULT_BATCH_SIZE,
  PRODUCT_EMBEDDING_LOCAL_DEFAULT_LIMIT,
  PRODUCT_EMBEDDING_LOCAL_MODEL_NAME
} from '@components/product-embedding/constants/product-embedding-local.constants';
import { LocalEmbeddingSyncOptionsDto } from '@components/product-embedding/dtos/local-embedding-sync-options.dto';
import { LocalEmbeddingChunkSyncResult } from '@components/product-embedding/entities/local-embedding-chunk-sync-result.entity';
import { LocalEmbeddingPersistInput } from '@components/product-embedding/entities/local-embedding-persist-input.entity';
import { LocalEmbeddingPromptPayload } from '@components/product-embedding/entities/local-embedding-prompt-payload.entity';
import { LocalEmbeddingSemanticContextInput } from '@components/product-embedding/entities/local-embedding-semantic-context-input.entity';
import { LocalEmbeddingSyncResult } from '@components/product-embedding/entities/local-embedding-sync-result.entity';
import { ProductForEmbedding } from '@components/product-embedding/entities/product-for-embedding.entity';
import { EmbeddingService } from '@core/modules/embedding';
import { PrismaService } from '@core/modules/prisma';
import { Injectable, Logger } from '@nestjs/common';
import { EmbeddingSyncStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';

const LOCAL_SYNC_RESULT_ZERO = {
  processed: 0,
  synced: 0,
  skipped: 0,
  failed: 0,
  batches: 0
} as const;

@Injectable()
export class ProductEmbeddingLocalService {
  private readonly logger = new Logger(ProductEmbeddingLocalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService
  ) {}

  async syncDirtyProducts(
    options: LocalEmbeddingSyncOptionsDto = {}
  ): Promise<LocalEmbeddingSyncResult> {
    const {
      force = false,
      limit = PRODUCT_EMBEDDING_LOCAL_DEFAULT_LIMIT,
      productId,
      batchSize = PRODUCT_EMBEDDING_LOCAL_DEFAULT_BATCH_SIZE
    } = options;

    const whereClause: Prisma.ProductWhereInput = {};

    if (productId) {
      whereClause.id = productId;
    } else if (!force) {
      whereClause.embeddingDirty = true;
    }

    const products = await this.prisma.product.findMany({
      where: whereClause,
      take: limit,
      select: {
        id: true
      },
      orderBy: {
        updatedAt: 'asc'
      }
    });

    if (products.length === 0) {
      return this.createEmptyResult();
    }

    const productIds = products.map((item) => item.id);

    const result = this.createInitialResult(productIds.length);

    for (let index = 0; index < productIds.length; index += batchSize) {
      const chunkIds = productIds.slice(index, index + batchSize);
      result.batches += 1;

      const chunkResult = await this.syncChunk(chunkIds, force);
      result.synced += chunkResult.synced;
      result.skipped += chunkResult.skipped;
      result.failed += chunkResult.failed;
    }

    return result;
  }

  private async syncChunk(
    productIds: string[],
    force: boolean
  ): Promise<LocalEmbeddingChunkSyncResult> {
    const products = await this.getProductsForEmbedding(productIds);

    const materialized = products.map((product) => {
      const payload = this.buildPromptPayload(product);
      const contentHash = this.hashPayload(payload);
      const embeddingInput = this.buildEmbeddingInput(payload);

      return {
        product,
        payload,
        contentHash,
        embeddingInput
      };
    });

    const unchanged = materialized.filter(
      (item) => !force && item.contentHash === item.product.embeddingContentHash
    );

    if (unchanged.length > 0) {
      await this.prisma.product.updateMany({
        where: {
          id: {
            in: unchanged.map((item) => item.product.id)
          }
        },
        data: {
          embeddingDirty: false,
          embeddingSyncStatus: EmbeddingSyncStatus.SYNCED,
          embeddingUpdatedAt: new Date()
        }
      });
    }

    const toSync = materialized.filter(
      (item) => force || item.contentHash !== item.product.embeddingContentHash
    );

    if (toSync.length === 0) {
      return {
        synced: 0,
        skipped: unchanged.length,
        failed: 0
      };
    }

    try {
      const embeddings = await this.embeddingService.embedPassageBatch(
        toSync.map((item) => item.embeddingInput)
      );

      if (embeddings.length !== toSync.length) {
        throw new Error('Embedding response length mismatch');
      }

      for (let i = 0; i < toSync.length; i += 1) {
        const current = toSync[i];
        const embedding = embeddings[i];

        await this.persistSyncedEmbedding({
          productId: current.product.id,
          contentHash: current.contentHash,
          embeddingInput: current.embeddingInput,
          shortDescription: current.payload.shortDescription,
          semanticContext: current.payload.semanticContext,
          embedding
        });
      }

      return {
        synced: toSync.length,
        skipped: unchanged.length,
        failed: 0
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed syncing local embeddings for ${toSync.length} products: ${message}`
      );
      await this.markFailed(
        toSync.map((item) => item.product.id),
        message
      );

      return {
        synced: 0,
        skipped: unchanged.length,
        failed: toSync.length
      };
    }
  }

  private createEmptyResult(): LocalEmbeddingSyncResult {
    return { ...LOCAL_SYNC_RESULT_ZERO };
  }

  private createInitialResult(processed: number): LocalEmbeddingSyncResult {
    return {
      ...LOCAL_SYNC_RESULT_ZERO,
      processed
    };
  }

  private async getProductsForEmbedding(
    productIds: string[]
  ): Promise<ProductForEmbedding[]> {
    return this.prisma.product.findMany({
      where: {
        id: {
          in: productIds
        }
      },
      select: {
        id: true,
        name: true,
        descriptionHtml: true,
        shortDescription: true,
        brand: true,
        gender: true,
        styleTags: true,
        material: true,
        season: true,
        fit: true,
        isActive: true,
        embeddingContentHash: true,
        category: {
          select: {
            name: true
          }
        }
      }
    }) as Promise<ProductForEmbedding[]>;
  }

  private buildPromptPayload(
    product: ProductForEmbedding
  ): LocalEmbeddingPromptPayload {
    const styleTags = this.normalizeStyleTags(product.styleTags);
    const shortDescription = this.normalizeDescription(
      product.shortDescription
    );
    const fallbackDescription = this.normalizeDescription(
      product.descriptionHtml
    );

    return {
      name: product.name,
      categoryName: product.category?.name || 'Không xác định',
      gender: product.gender || 'UNISEX',
      styleTags,
      material: product.material || 'Chưa xác định',
      fit: product.fit || 'Mọi form',
      season: product.season || 'Mọi mùa',
      brand: product.brand || 'Không xác định',
      isActive: product.isActive,
      shortDescription: shortDescription || fallbackDescription,
      semanticContext: this.buildSemanticContext({
        categoryName: product.category?.name,
        gender: product.gender,
        styleTags,
        material: product.material,
        fit: product.fit,
        season: product.season,
        brand: product.brand
      })
    };
  }

  private buildEmbeddingInput(payload: LocalEmbeddingPromptPayload): string {
    const styleLabel = payload.styleTags.length
      ? payload.styleTags.join(', ')
      : 'Không xác định';

    return [
      `Sản phẩm: ${payload.name}`,
      `Danh mục: ${payload.categoryName}`,
      `Giới tính: ${payload.gender}`,
      `Phong cách: ${styleLabel}`,
      `Chất liệu: ${payload.material}`,
      `Form: ${payload.fit}`,
      `Mùa: ${payload.season}`,
      `Thương hiệu: ${payload.brand}`,
      `Mô tả ngắn: ${payload.shortDescription}`,
      `Ngữ cảnh ngữ nghĩa: ${payload.semanticContext}`,
      `Trạng thái: ${payload.isActive ? 'đang bán' : 'ngừng bán'}`
    ].join('\n');
  }

  private async persistSyncedEmbedding(input: LocalEmbeddingPersistInput) {
    await this.prisma.$transaction(async (tx) => {
      await tx.productEmbedding.updateMany({
        where: {
          productId: input.productId,
          modelName: PRODUCT_EMBEDDING_LOCAL_MODEL_NAME,
          isActive: true
        },
        data: {
          isActive: false
        }
      });

      await tx.$executeRaw`
        INSERT INTO "product_embeddings" (
          "id",
          "product_id",
          "model_name",
          "summary_model",
          "embedding_vector",
          "embedding_dim",
          "embedding_input_text",
          "summary_text",
          "semantic_context",
          "content_hash",
          "status",
          "error_message",
          "last_embedded_at",
          "is_active",
          "created_at",
          "updated_at"
        ) VALUES (
          ${randomUUID()},
          ${input.productId},
          ${PRODUCT_EMBEDDING_LOCAL_MODEL_NAME},
          ${PRODUCT_EMBEDDING_LOCAL_MODEL_NAME},
          ${this.toVectorLiteral(input.embedding)}::vector,
          ${input.embedding.length},
          ${input.embeddingInput},
          ${input.shortDescription || null},
          ${input.semanticContext || null},
          ${input.contentHash},
          ${EmbeddingSyncStatus.SYNCED}::"EmbeddingSyncStatus",
          ${null},
          NOW(),
          ${true},
          NOW(),
          NOW()
        )
        ON CONFLICT ("product_id", "model_name")
        DO UPDATE SET
          "summary_model" = EXCLUDED."summary_model",
          "embedding_vector" = EXCLUDED."embedding_vector",
          "embedding_dim" = EXCLUDED."embedding_dim",
          "embedding_input_text" = EXCLUDED."embedding_input_text",
          "summary_text" = EXCLUDED."summary_text",
          "semantic_context" = EXCLUDED."semantic_context",
          "content_hash" = EXCLUDED."content_hash",
          "status" = EXCLUDED."status",
          "error_message" = EXCLUDED."error_message",
          "last_embedded_at" = EXCLUDED."last_embedded_at",
          "is_active" = EXCLUDED."is_active",
          "updated_at" = NOW()
      `;

      await tx.product.update({
        where: { id: input.productId },
        data: {
          embeddingSyncStatus: EmbeddingSyncStatus.SYNCED,
          embeddingDirty: false,
          embeddingContentHash: input.contentHash,
          embeddingUpdatedAt: new Date()
        }
      });
    });
  }

  private async markFailed(productIds: string[], message: string) {
    if (productIds.length === 0) {
      return;
    }

    await this.prisma.product.updateMany({
      where: {
        id: {
          in: productIds
        }
      },
      data: {
        embeddingSyncStatus: EmbeddingSyncStatus.FAILED,
        embeddingDirty: true,
        embeddingUpdatedAt: new Date()
      }
    });

    await this.prisma.productEmbedding.updateMany({
      where: {
        productId: {
          in: productIds
        },
        modelName: PRODUCT_EMBEDDING_LOCAL_MODEL_NAME,
        isActive: true
      },
      data: {
        status: EmbeddingSyncStatus.FAILED,
        errorMessage: message,
        updatedAt: new Date()
      }
    });
  }

  private buildSemanticContext(
    input: LocalEmbeddingSemanticContextInput
  ): string {
    const parts = [
      input.categoryName ? `thuộc danh mục ${input.categoryName}` : null,
      input.gender ? `dành cho ${input.gender}` : null,
      input.styleTags.length > 0
        ? `phong cách ${input.styleTags.join(', ')}`
        : null,
      input.material ? `chất liệu ${input.material}` : null,
      input.fit ? `form ${input.fit}` : null,
      input.season ? `sử dụng phù hợp mùa ${input.season}` : null,
      input.brand ? `thương hiệu ${input.brand}` : null
    ].filter((item): item is string => Boolean(item));

    return parts.join('. ');
  }

  private normalizeStyleTags(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private normalizeDescription(value: string | null): string {
    if (!value) {
      return '';
    }

    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private hashPayload(payload: object): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
