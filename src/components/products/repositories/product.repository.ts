import { PRODUCT_EMBEDDING_LOCAL_MODEL_NAME } from '@components/product-embedding/constants/product-embedding-local.constants';
import { ProductDatasource } from '@components/products/datasources/product.datasource';
import { QueryProductDto } from '@components/products/dtos/query-product.dto';
import { ProductEntity } from '@components/products/entities/product.entity';
import { EmbeddingService } from '@core/modules/embedding';
import { PrismaService } from '@core/modules/prisma';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Product } from '@prisma/client';

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: {
      include: {
        file: true;
        optionValue: true;
      };
      orderBy: {
        position: 'asc';
      };
    };
    variants: {
      include: {
        colorOptionValue: true;
        sizeOptionValue: true;
      };
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

type ProductImageSyncInput = {
  fileId: string;
  isPrimary: boolean;
  position: number;
};

export type ProductAutocompleteItem = {
  name: string;
  score: number;
};

type RankedProductItem = {
  id: string;
  score: number;
};

type CategoryTreeIdRow = {
  id: string;
};

type VariantSummary = {
  numberOfVariants: number;
  minVariantPrice: number | null;
  maxVariantPrice: number | null;
  totalVariantStock: number;
};

const MAX_VECTOR_SEARCH_CANDIDATES = 3000;
const DEFAULT_VECTOR_SEMANTIC_WEIGHT = 0.75;
const DEFAULT_VECTOR_LEXICAL_WEIGHT = 0.25;
const DEFAULT_VECTOR_MIN_SEMANTIC_SCORE = 0.2;

const productInclude = {
  category: true,
  images: {
    include: {
      file: true,
      optionValue: true
    },
    orderBy: {
      position: 'asc'
    }
  },
  variants: {
    orderBy: {
      createdAt: 'desc'
    },
    include: {
      colorOptionValue: true,
      sizeOptionValue: true
    }
  }
} as const;

const productListSelect = Prisma.validator<Prisma.ProductSelect>()({
  id: true,
  slug: true,
  name: true,
  brand: true,
  gender: true,
  material: true,
  season: true,
  fit: true,
  isActive: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  },
  images: {
    orderBy: [
      {
        isPrimary: 'desc'
      },
      {
        position: 'asc'
      },
      {
        createdAt: 'asc'
      }
    ],
    take: 1,
    select: {
      id: true,
      isPrimary: true,
      position: true,
      optionValueId: true,
      file: {
        select: {
          id: true,
          url: true,
          filename: true,
          publicId: true,
          mimetype: true,
          size: true
        }
      }
    }
  }
});

type ProductListItem = Prisma.ProductGetPayload<{
  select: typeof productListSelect;
}> &
  VariantSummary;

@Injectable()
export class ProductRepository extends BaseRepository<ProductEntity, Product> {
  private readonly logger = new Logger(ProductRepository.name);
  private readonly vectorSemanticWeight: number;
  private readonly vectorLexicalWeight: number;
  private readonly vectorMinSemanticScore: number;

  constructor(
    private readonly datasource: ProductDatasource,
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService
  ) {
    super(ProductEntity);

    this.vectorSemanticWeight = Math.max(
      0,
      this.configService.get<number>(
        'embedding.search.semanticWeight',
        DEFAULT_VECTOR_SEMANTIC_WEIGHT
      )
    );

    this.vectorLexicalWeight = Math.max(
      0,
      this.configService.get<number>(
        'embedding.search.lexicalWeight',
        DEFAULT_VECTOR_LEXICAL_WEIGHT
      )
    );

    this.vectorMinSemanticScore = this.clamp(
      this.configService.get<number>(
        'embedding.search.minSemanticScore',
        DEFAULT_VECTOR_MIN_SEMANTIC_SCORE
      ),
      -1,
      1
    );
  }

  async findAll(
    query: QueryProductDto,
    options?: { includeInactive?: boolean }
  ): Promise<PaginatedData<ProductListItem>> {
    const { pagination, sort, filter, search, categorySlug } = query;
    const trimmedSearch = search?.trim();
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    if (categorySlug) {
      const categoryTreeIds =
        await this.findCategoryTreeIdsBySlug(categorySlug);

      if (categoryTreeIds.length === 0) {
        return {
          items: [],
          meta: {
            total: 0,
            page,
            limit,
            totalPages: 0
          }
        };
      }

      where.categoryId = {
        in: categoryTreeIds
      };
    }

    if (filter && filter.length > 0) {
      const filterWhere = buildPrismaWhereFromFilters(filter);
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      const nextAnd = Array.isArray(filterWhere.AND) ? filterWhere.AND : [];
      where.AND = [...existingAnd, ...nextAnd] as Prisma.ProductWhereInput[];
    }

    if (trimmedSearch) {
      const vectorResult = await this.findAllByVectorSearch(
        trimmedSearch,
        where,
        page,
        limit,
        skip
      );

      if (vectorResult) {
        return vectorResult;
      }

      where.OR = this.buildLexicalSearchCondition(trimmedSearch);
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.ProductOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.ProductOrderByWithRelationInput);

    const dataPromise = this.prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: finalOrderBy,
      select: productListSelect
    });
    const countPromise = this.datasource.count(where);

    const [data, total] = await Promise.all([dataPromise, countPromise]);
    const items = await this.attachVariantSummary(data);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  private async findAllByVectorSearch(
    search: string,
    baseWhere: Prisma.ProductWhereInput,
    page: number,
    limit: number,
    skip: number
  ): Promise<PaginatedData<ProductListItem> | null> {
    let queryEmbedding: number[];

    try {
      queryEmbedding = await this.embeddingService.embedQuery(search);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Vector search disabled for this request: ${message}`);
      return null;
    }

    if (queryEmbedding.length === 0) {
      return null;
    }

    const candidates = await this.prisma.product.findMany({
      where: baseWhere,
      select: {
        id: true
      },
      take: MAX_VECTOR_SEARCH_CANDIDATES,
      orderBy: {
        updatedAt: 'desc'
      }
    });

    if (candidates.length === 0) {
      return {
        items: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      };
    }

    const candidateIds = candidates.map((item) => item.id);
    const vectorLiteral = this.toVectorLiteral(queryEmbedding);

    const semanticMatches = await this.prisma.$queryRaw<RankedProductItem[]>`
      SELECT
        pe.product_id AS id,
        (1 - (pe.embedding_vector <=> ${vectorLiteral}::vector))::double precision AS score
      FROM product_embeddings pe
      WHERE pe.is_active = TRUE
        AND pe.model_name = ${PRODUCT_EMBEDDING_LOCAL_MODEL_NAME}
        AND pe.product_id = ANY(${candidateIds}::text[])
        AND (1 - (pe.embedding_vector <=> ${vectorLiteral}::vector)) >= ${this.vectorMinSemanticScore}
      ORDER BY score DESC, pe.updated_at DESC
      LIMIT ${MAX_VECTOR_SEARCH_CANDIDATES};
    `;

    const trimmedSearch = search.trim();
    const lexicalMatches = await this.prisma.$queryRaw<RankedProductItem[]>`
      SELECT
        p.id,
        (
          GREATEST(
            similarity(unaccent(lower(p.name)), unaccent(lower(${trimmedSearch}))),
            similarity(unaccent(lower(COALESCE(p.brand, ''))), unaccent(lower(${trimmedSearch}))),
            similarity(unaccent(lower(p.slug)), unaccent(lower(${trimmedSearch}))),
            similarity(unaccent(lower(COALESCE(p.description_html, ''))), unaccent(lower(${trimmedSearch})))
          )
          +
          CASE
            WHEN unaccent(lower(p.name)) = unaccent(lower(${trimmedSearch})) THEN 2
            ELSE 0
          END
          +
          CASE
            WHEN unaccent(lower(p.name)) LIKE unaccent(${`${trimmedSearch}%`}) THEN 1
            ELSE 0
          END
        )::double precision AS score
      FROM products p
      WHERE p.id = ANY(${candidateIds}::text[])
        AND (
          unaccent(lower(p.name)) ILIKE unaccent(${`%${trimmedSearch}%`})
          OR unaccent(lower(COALESCE(p.brand, ''))) ILIKE unaccent(${`%${trimmedSearch}%`})
          OR unaccent(lower(p.slug)) ILIKE unaccent(${`%${trimmedSearch}%`})
          OR unaccent(lower(COALESCE(p.description_html, ''))) ILIKE unaccent(${`%${trimmedSearch}%`})
          OR unaccent(lower(p.name)) % unaccent(lower(${trimmedSearch}))
          OR unaccent(lower(COALESCE(p.brand, ''))) % unaccent(lower(${trimmedSearch}))
          OR unaccent(lower(p.slug)) % unaccent(lower(${trimmedSearch}))
          OR unaccent(lower(COALESCE(p.description_html, ''))) % unaccent(lower(${trimmedSearch}))
        )
      ORDER BY score DESC, p.updated_at DESC
      LIMIT ${MAX_VECTOR_SEARCH_CANDIDATES};
    `;

    const semanticScoreById = new Map<string, number>();
    for (const item of semanticMatches) {
      semanticScoreById.set(item.id, item.score);
    }

    const lexicalScoreById = new Map<string, number>();
    for (const item of lexicalMatches) {
      lexicalScoreById.set(item.id, item.score);
    }

    const ranked = new Map<string, RankedProductItem>();

    for (const [id, score] of semanticScoreById.entries()) {
      ranked.set(id, {
        id,
        score:
          score * this.vectorSemanticWeight +
          (lexicalScoreById.get(id) ?? 0) * this.vectorLexicalWeight
      });
    }

    for (const [id, score] of lexicalScoreById.entries()) {
      if (ranked.has(id)) {
        continue;
      }

      ranked.set(id, {
        id,
        score:
          (semanticScoreById.get(id) ?? 0) * this.vectorSemanticWeight +
          score * this.vectorLexicalWeight
      });
    }

    const mergedIds = Array.from(ranked.values())
      .sort((a, b) => b.score - a.score)
      .map((item) => item.id);

    const total = mergedIds.length;
    const pageIds = mergedIds.slice(skip, skip + limit);

    if (pageIds.length === 0) {
      return {
        items: [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    }

    const data = await this.prisma.product.findMany({
      where: {
        id: {
          in: pageIds
        }
      },
      select: productListSelect
    });

    const itemsWithVariantSummary = await this.attachVariantSummary(data);
    const itemsById = new Map(
      itemsWithVariantSummary.map((item) => [item.id, item])
    );
    const orderedItems = pageIds
      .map((id) => itemsById.get(id))
      .filter((item): item is ProductListItem => Boolean(item));

    return {
      items: orderedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  private buildLexicalSearchCondition(
    search: string
  ): Prisma.ProductWhereInput['OR'] {
    return [
      { name: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } },
      { descriptionHtml: { contains: search, mode: 'insensitive' } }
    ];
  }

  private async findCategoryTreeIdsBySlug(slug: string): Promise<string[]> {
    const normalizedSlug = slug.trim();

    if (!normalizedSlug) return [];

    const rows = await this.prisma.$queryRaw<CategoryTreeIdRow[]>`
      WITH RECURSIVE category_tree AS (
        SELECT c.id
        FROM categories c
        WHERE c.slug = ${normalizedSlug}

        UNION ALL

        SELECT child.id
        FROM categories child
        INNER JOIN category_tree parent ON child.parent_id = parent.id
      )
      SELECT id
      FROM category_tree;
    `;

    return rows.map((row) => row.id);
  }

  private toVectorLiteral(embedding: number[]): string {
    const normalized = embedding.map((value) => {
      if (!Number.isFinite(value)) {
        return 0;
      }

      return Number(value.toFixed(12));
    });

    return `[${normalized.join(',')}]`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private async attachVariantSummary(
    items: Prisma.ProductGetPayload<{ select: typeof productListSelect }>[]
  ): Promise<ProductListItem[]> {
    if (items.length === 0) {
      return [];
    }

    const summaryByProductId = await this.getVariantSummaryByProductIds(
      items.map((item) => item.id)
    );

    return items.map((item) => {
      const summary = summaryByProductId.get(item.id);
      return {
        ...item,
        numberOfVariants: summary?.numberOfVariants ?? 0,
        minVariantPrice: summary?.minVariantPrice ?? null,
        maxVariantPrice: summary?.maxVariantPrice ?? null,
        totalVariantStock: summary?.totalVariantStock ?? 0
      };
    });
  }

  private async getVariantSummaryByProductIds(
    productIds: string[]
  ): Promise<Map<string, VariantSummary>> {
    if (productIds.length === 0) {
      return new Map();
    }

    const grouped = await this.prisma.variant.groupBy({
      by: ['productId'],
      where: {
        productId: {
          in: productIds
        }
      },
      _count: {
        _all: true
      },
      _sum: {
        stock: true
      },
      _min: {
        price: true
      },
      _max: {
        price: true
      }
    });

    const result = new Map<string, VariantSummary>();
    for (const row of grouped) {
      result.set(row.productId, {
        numberOfVariants: row._count._all,
        minVariantPrice:
          row._min.price !== null ? Number(row._min.price) : null,
        maxVariantPrice:
          row._max.price !== null ? Number(row._max.price) : null,
        totalVariantStock: row._sum.stock ?? 0
      });
    }

    return result;
  }

  async findById(
    id: string,
    options?: { includeInactive?: boolean }
  ): Promise<ProductWithRelations | null> {
    return this.datasource.findOneByCondition(
      {
        id,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.ProductWhereInput,
      {
        include: productInclude
      }
    ) as Promise<ProductWithRelations | null>;
  }

  async findBySlug(
    slug: string,
    options?: { includeInactive?: boolean }
  ): Promise<ProductWithRelations | null> {
    return this.datasource.findOneByCondition(
      {
        slug,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.ProductWhereInput,
      {
        include: productInclude
      }
    ) as Promise<ProductWithRelations | null>;
  }

  async createProduct(
    data: Prisma.ProductCreateInput
  ): Promise<ProductWithRelations> {
    return this.datasource.create(data, {
      include: productInclude
    }) as Promise<ProductWithRelations>;
  }

  async updateProduct(
    id: string,
    data: Prisma.ProductUpdateInput
  ): Promise<ProductWithRelations> {
    return this.datasource.updateById(id, data, {
      include: productInclude
    }) as Promise<ProductWithRelations>;
  }

  async deleteProduct(id: string): Promise<Product> {
    return this.datasource.deleteById(id);
  }

  async findExistingFileIds(fileIds: string[]): Promise<string[]> {
    if (fileIds.length === 0) {
      return [];
    }

    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds }
      },
      select: {
        id: true
      }
    });

    return files.map((file) => file.id);
  }

  async replaceImages(
    productId: string,
    images: ProductImageSyncInput[]
  ): Promise<ProductWithRelations> {
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({
        where: {
          productId,
          optionValueId: null
        }
      });

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((image) => ({
            productId,
            optionValueId: null,
            fileId: image.fileId,
            isPrimary: image.isPrimary,
            position: image.position
          }))
        });
      }
    });

    return this.findById(productId, {
      includeInactive: true
    }) as Promise<ProductWithRelations>;
  }

  async autocomplete(
    keyword: string,
    limit: number
  ): Promise<ProductAutocompleteItem[]> {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      return [];
    }

    const safeLimit = Math.min(Math.max(limit, 1), 20);

    return this.prisma.$queryRaw<ProductAutocompleteItem[]>`
      SELECT
        p.name,
        (
          GREATEST(
            similarity(unaccent(lower(p.name)), unaccent(lower(${trimmedKeyword}))),
            similarity(unaccent(lower(COALESCE(p.brand, ''))), unaccent(lower(${trimmedKeyword}))),
            similarity(unaccent(lower(p.slug)), unaccent(lower(${trimmedKeyword})))
          )
          +
          CASE 
            WHEN unaccent(lower(p.name)) = unaccent(lower(${trimmedKeyword})) THEN 2
            ELSE 0
          END
          +
          CASE 
            WHEN unaccent(lower(p.name)) LIKE unaccent(${`${trimmedKeyword}%`}) THEN 1
            ELSE 0
          END
        ) AS score
      FROM products p
      WHERE p.is_active = TRUE
        AND (
          unaccent(lower(p.name)) ILIKE unaccent(${`%${trimmedKeyword}%`})
          OR unaccent(lower(COALESCE(p.brand, ''))) ILIKE unaccent(${`%${trimmedKeyword}%`})
          OR unaccent(lower(p.slug)) ILIKE unaccent(${`%${trimmedKeyword}%`})
          OR unaccent(lower(p.name)) % unaccent(lower(${trimmedKeyword}))
          OR unaccent(lower(COALESCE(p.brand, ''))) % unaccent(lower(${trimmedKeyword}))
        )
      ORDER BY score DESC, p.updated_at DESC
      LIMIT ${safeLimit};
    `;
  }
}
