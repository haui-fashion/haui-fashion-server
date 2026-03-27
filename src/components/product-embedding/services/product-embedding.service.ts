import {
  DEFAULT_PRODUCT_EMBEDDING_SYNC_CONFIG,
  PRODUCT_EMBEDDING_SYNC_STATUS_CONFIG_PATHS
} from '@components/product-embedding/constants/product-embedding.constants';
import { SummaryProductInformationDto } from '@components/product-embedding/dtos/summary-product-information.dto';
import { ProductForEmbedding } from '@components/product-embedding/entities/product-for-embedding.entity';
import { ProductSummary } from '@components/product-embedding/entities/product-summary.entity';
import { PrismaService } from '@core/modules/prisma';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingSyncStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';

/**
 * @deprecated Use ProductEmbeddingLocalService for the default embedding sync pipeline.
 */
@Injectable()
export class ProductEmbeddingService {
  private readonly logger = new Logger(ProductEmbeddingService.name);
  private readonly embeddingModel: string;
  private readonly embeddingTaskType: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    this.embeddingModel =
      this.configService.get<string>('gemini.models.embedding') ||
      'gemini-embedding-001';

    this.embeddingTaskType =
      this.configService.get<string>(
        PRODUCT_EMBEDDING_SYNC_STATUS_CONFIG_PATHS.embeddingTaskType
      ) || DEFAULT_PRODUCT_EMBEDDING_SYNC_CONFIG.embeddingTaskType;
  }

  async getProductsForEmbedding(
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
        },
        variants: {
          select: {
            colorOptionValue: {
              select: {
                value: true
              }
            },
            sizeOptionValue: {
              select: {
                value: true
              }
            }
          }
        }
      }
    }) as Promise<ProductForEmbedding[]>;
  }

  public hashPayload(payload: Record<string, unknown>): string {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  public buildPromptPayload(product: ProductForEmbedding) {
    const colors = this.normalizeVariantValues(
      product.variants,
      'colorOptionValue'
    );
    const sizes = this.normalizeVariantValues(
      product.variants,
      'sizeOptionValue'
    );

    return {
      name: product.name,
      categoryName: product.category?.name || 'Không xác định',
      gender: product.gender || 'UNISEX',
      colors,
      sizes,
      styleTags: this.normalizeStyleTags(product.styleTags),
      material: product.material || 'Chưa xác định',
      fit: product.fit || 'Chưa xác định',
      season: product.season || 'Mọi mùa',
      descriptionHtml: this.normalizeDescription(product.descriptionHtml),
      shortDescription: this.normalizeDescription(product.shortDescription),
      brand: product.brand,
      isActive: product.isActive
    };
  }

  buildSummaryJsonlLines(
    products: ProductForEmbedding[]
  ): Record<string, unknown>[] {
    return products.map((product) => {
      const payload = this.buildPromptPayload(product);

      const dto = new SummaryProductInformationDto();
      dto.name = payload.name;
      dto.categoryName = payload.categoryName;
      dto.gender = payload.gender;
      dto.colors = payload.colors;
      dto.sizes = payload.sizes;
      dto.styleTags = payload.styleTags;
      dto.material = payload.material;
      dto.fit = payload.fit;
      dto.season = payload.season;
      dto.descriptionHtml = payload.descriptionHtml;
      dto.brand = payload.brand;
      dto.isActive = payload.isActive;

      const prompt = `Bạn là chuyên gia chuẩn hóa dữ liệu sản phẩm thời trang cho hệ thống semantic search.
      Trả về JSON hợp lệ, có định dạng là đối tượng có { "shortDescription": string, "semanticContext": string, "noiseReducedAttributes": string[] }.
      Không thêm markdown.
      Dữ liệu: ${JSON.stringify(dto)}`;

      return {
        key: product.id,
        request: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }
      };
    });
  }

  buildEmbeddingJsonlLines(
    products: ProductForEmbedding[],
    summaries: Map<string, ProductSummary>
  ): Record<string, unknown>[] {
    return products.map((product) => {
      const payload = this.buildPromptPayload(product);
      const summary = summaries.get(product.id);

      if (!summary) {
        throw new Error(`Missing summary for product ${product.id}`);
      }

      const prompt = this.buildEmbeddingPrompt(payload, summary);

      return {
        key: product.id,
        request: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {}
        }
      };
    });
  }

  async persistBatchResults(
    productIds: string[],
    summaries: Map<string, ProductSummary>,
    embeddings: Map<string, number[]>
  ) {
    const products = await this.getProductsForEmbedding(productIds);

    await this.prisma.$transaction(async (tx) => {
      for (const product of products) {
        const payload = this.buildPromptPayload(product);
        const contentHash = this.hashPayload(
          payload as Record<string, unknown>
        );
        const summary = summaries.get(product.id);
        const embedding = embeddings.get(product.id);

        if (!summary || !embedding) {
          this.logger.warn(
            `Skipping persistence for product ${product.id} due to missing summary or embedding`
          );
          continue;
        }

        const embeddingPrompt = this.buildEmbeddingPrompt(payload, summary);

        await tx.productEmbedding.updateMany({
          where: {
            productId: product.id,
            modelName: this.embeddingModel,
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
            ${product.id},
            ${this.embeddingModel},
            ${this.configService.get<string>('gemini.models.generation') || 'gemini-2.5-flash'},
            ${this.toVectorLiteral(embedding)}::vector,
            ${embedding.length},
            ${embeddingPrompt},
            ${summary.shortDescription},
            ${summary.semanticContext},
            ${contentHash},
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
          where: { id: product.id },
          data: {
            embeddingSyncStatus: EmbeddingSyncStatus.SYNCED,
            embeddingDirty: false,
            embeddingContentHash: contentHash,
            embeddingUpdatedAt: new Date()
          }
        });
      }
    });
  }

  async markFailed(productIds: string[], message: string) {
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
        modelName: this.embeddingModel,
        isActive: true
      },
      data: {
        status: EmbeddingSyncStatus.FAILED,
        errorMessage: message,
        updatedAt: new Date()
      }
    });
  }

  private buildEmbeddingPrompt(
    payload: ReturnType<typeof this.buildPromptPayload>,
    summary: ProductSummary
  ): string {
    const colors = payload.colors.length
      ? payload.colors.join(', ')
      : 'Không xác định';
    const sizes = payload.sizes.length
      ? payload.sizes.join(', ')
      : 'Không xác định';
    const styleTags = payload.styleTags.length
      ? payload.styleTags.join(', ')
      : 'Không xác định';

    const semanticContext = [
      summary.semanticContext,
      summary.noiseReducedAttributes.join(', ')
    ]
      .filter(Boolean)
      .join('. ');

    return `
    Biểu diễn sản phẩm sau dưới dạng ngữ nghĩa phục vụ tìm kiếm, gợi ý sản phẩm và chatbot.

    Sản phẩm:
    ${payload.name}.

    Danh mục: thời trang, ${payload.categoryName}.
    Giới tính: ${payload.gender}.
    Màu sắc: ${colors}.
    Kích cỡ: ${sizes}.

    Thuộc tính:
    - Màu: ${colors}
    - Size: ${sizes}
    - Phong cách: ${styleTags}
    - Chất liệu: ${payload.material}
    - Form dáng: ${payload.fit}
    - Mùa: ${payload.season}

    Mô tả ngữ nghĩa:
    Đây là một ${payload.categoryName} dành cho ${payload.gender}, có các màu ${colors} và size ${sizes}, phù hợp với phong cách ${styleTags}.
    Sản phẩm được làm từ ${payload.material}, form ${payload.fit}, thích hợp sử dụng trong mùa ${payload.season}.

    Mô tả ngắn:
    ${summary.shortDescription}

    Đặc điểm nổi bật:
    ${semanticContext}

    Ngữ cảnh sử dụng:
    ${semanticContext}

    Nội dung gốc đã được làm sạch:
    ${payload.descriptionHtml}

    Hãy biểu diễn nội dung trên thành vector embedding ngữ nghĩa.
    `;
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

  private normalizeVariantValues(
    variants: ProductForEmbedding['variants'],
    key: 'colorOptionValue' | 'sizeOptionValue'
  ): string[] {
    return [
      ...new Set(
        variants
          .map((variant) => variant[key]?.value?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ];
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

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
