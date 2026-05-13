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

type RerankCandidateProduct = Prisma.ProductGetPayload<{
  select: {
    id: true;
    name: true;
    brand: true;
    shortDescription: true;
    descriptionHtml: true;
    material: true;
    season: true;
    fit: true;
    styleTags: true;
    gender: true;
    category: {
      select: {
        name: true;
      };
    };
    variants: {
      select: {
        sizeOptionValue: {
          select: {
            value: true;
          };
        };
        colorOptionValue: {
          select: {
            value: true;
          };
        };
      };
    };
  };
}>;

type CategoryTreeIdRow = {
  id: string;
};

type VariantSummary = {
  numberOfVariants: number;
  minVariantPrice: number | null;
  maxVariantPrice: number | null;
  totalVariantStock: number;
  hexColors?: string[];
};

const MAX_VECTOR_SEARCH_CANDIDATES = 3000;
const DEFAULT_VECTOR_SEMANTIC_WEIGHT = 0.75;
const DEFAULT_VECTOR_LEXICAL_WEIGHT = 0.25;
const DEFAULT_VECTOR_MIN_SEMANTIC_SCORE = 0.2;
const DEFAULT_VECTOR_RERANK_CANDIDATE_LIMIT = 30;
const DEFAULT_VECTOR_RERANK_WEIGHT = 0.55;
const DEFAULT_VECTOR_HYBRID_WEIGHT = 0.45;
const DEFAULT_VECTOR_DYNAMIC_THRESHOLD_MIN_SCORE = 0.35;
const DEFAULT_VECTOR_DYNAMIC_THRESHOLD_TOP_RATIO = 0.72;
const DEFAULT_VECTOR_DYNAMIC_THRESHOLD_MAX_DROP = 0.28;
const DEFAULT_VECTOR_DYNAMIC_THRESHOLD_MIN_RESULTS = 0;
const DEFAULT_VECTOR_RERANK_TEXT_MAX_LENGTH = 700;

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
  },
  variants: {
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      colorOptionValue: {
        select: {
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
  private readonly vectorRerankCandidateLimit: number;
  private readonly vectorRerankWeight: number;
  private readonly vectorHybridWeight: number;
  private readonly vectorDynamicThresholdMinScore: number;
  private readonly vectorDynamicThresholdTopRatio: number;
  private readonly vectorDynamicThresholdMaxDrop: number;
  private readonly vectorDynamicThresholdMinResults: number;
  private readonly vectorRerankTextMaxLength: number;

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

    this.vectorRerankCandidateLimit = Math.min(
      Math.max(
        this.configService.get<number>(
          'embedding.search.rerankCandidateLimit',
          DEFAULT_VECTOR_RERANK_CANDIDATE_LIMIT
        ),
        20
      ),
      MAX_VECTOR_SEARCH_CANDIDATES
    );

    this.vectorRerankWeight = this.clamp(
      this.configService.get<number>(
        'embedding.search.rerankWeight',
        DEFAULT_VECTOR_RERANK_WEIGHT
      ),
      0,
      1
    );

    this.vectorHybridWeight = this.clamp(
      this.configService.get<number>(
        'embedding.search.hybridWeight',
        DEFAULT_VECTOR_HYBRID_WEIGHT
      ),
      0,
      1
    );

    this.vectorDynamicThresholdMinScore = this.clamp(
      this.configService.get<number>(
        'embedding.search.dynamicThreshold.minScore',
        DEFAULT_VECTOR_DYNAMIC_THRESHOLD_MIN_SCORE
      ),
      0,
      1
    );

    this.vectorDynamicThresholdTopRatio = this.clamp(
      this.configService.get<number>(
        'embedding.search.dynamicThreshold.topRatio',
        DEFAULT_VECTOR_DYNAMIC_THRESHOLD_TOP_RATIO
      ),
      0,
      1
    );

    this.vectorDynamicThresholdMaxDrop = this.clamp(
      this.configService.get<number>(
        'embedding.search.dynamicThreshold.maxDrop',
        DEFAULT_VECTOR_DYNAMIC_THRESHOLD_MAX_DROP
      ),
      0,
      1
    );

    this.vectorDynamicThresholdMinResults = Math.max(
      this.configService.get<number>(
        'embedding.search.dynamicThreshold.minResults',
        DEFAULT_VECTOR_DYNAMIC_THRESHOLD_MIN_RESULTS
      ),
      1
    );

    this.vectorRerankTextMaxLength = Math.max(
      this.configService.get<number>(
        'embedding.search.rerankTextMaxLength',
        DEFAULT_VECTOR_RERANK_TEXT_MAX_LENGTH
      ),
      200
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
      const remappedFilter = filter.map((f) => {
        if (f.column === 'price') {
          return {
            ...f,
            column: 'variants.some.price'
          };
        }
        return f;
      });

      const filterWhere = buildPrismaWhereFromFilters(remappedFilter);
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      const nextAnd = Array.isArray(filterWhere.AND) ? filterWhere.AND : [];
      where.AND = [...existingAnd, ...nextAnd] as Prisma.ProductWhereInput[];
    }

    if (trimmedSearch) {
      if (trimmedSearch.length >= 3) {
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

    const hybridScores = this.mergeHybridScores(
      semanticScoreById,
      lexicalScoreById
    );

    const hybridRanked = Array.from(hybridScores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);

    if (hybridRanked.length === 0) {
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

    const rerankCandidateIds = hybridRanked
      .slice(0, this.vectorRerankCandidateLimit)
      .map((item) => item.id);

    let finalScores = new Map<string, number>(hybridScores);

    if (rerankCandidateIds.length > 1) {
      try {
        const rerankScores = await this.rerankCandidates(
          search,
          rerankCandidateIds
        );
        finalScores = this.combineHybridAndRerankScores(
          hybridScores,
          rerankScores
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Cross-encoder rerank is unavailable for this request: ${message}`
        );
      }
    }

    const rankedAfterRerank = Array.from(finalScores.entries())
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);

    const filteredIds = this.applyDynamicThreshold(rankedAfterRerank);
    const mergedIds =
      filteredIds.length > 0
        ? filteredIds
        : rankedAfterRerank.map((item) => item.id);

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

  private mergeHybridScores(
    semanticScoreById: Map<string, number>,
    lexicalScoreById: Map<string, number>
  ): Map<string, number> {
    const semanticNormalized = this.normalizeScoreMap(semanticScoreById);
    const lexicalNormalized = this.normalizeScoreMap(lexicalScoreById);
    const ranked = new Map<string, number>();

    for (const id of new Set([
      ...semanticNormalized.keys(),
      ...lexicalNormalized.keys()
    ])) {
      const semantic = semanticNormalized.get(id) ?? 0;
      const lexical = lexicalNormalized.get(id) ?? 0;
      const score =
        semantic * this.vectorSemanticWeight +
        lexical * this.vectorLexicalWeight;

      ranked.set(id, this.clamp(score, 0, 1));
    }

    return ranked;
  }

  private async rerankCandidates(
    search: string,
    candidateIds: string[]
  ): Promise<Map<string, number>> {
    const candidates = await this.prisma.product.findMany({
      where: {
        id: {
          in: candidateIds
        }
      },
      select: {
        id: true,
        styleTags: true,
        name: true,
        brand: true,
        shortDescription: true,
        descriptionHtml: true,
        material: true,
        season: true,
        fit: true,
        gender: true,
        category: {
          select: {
            name: true
          }
        },
        variants: {
          select: {
            sizeOptionValue: {
              select: {
                value: true
              }
            },
            colorOptionValue: {
              select: {
                value: true
              }
            }
          },
          take: 16,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    const candidateById = new Map(
      candidates.map((candidate) => [candidate.id, candidate])
    );

    const orderedCandidates = candidateIds
      .map((id) => candidateById.get(id))
      .filter(
        (item): item is RerankCandidateProduct =>
          item !== undefined && item !== null
      );

    if (orderedCandidates.length === 0) {
      return new Map();
    }

    const rerankTexts = orderedCandidates.map((candidate) =>
      this.buildRerankText(candidate)
    );
    const rawScores = await this.embeddingService.rerank(search, rerankTexts);

    const sigmoidScores = rawScores.map((score) => this.sigmoid(score));
    const normalizedScores = this.normalizeScores(sigmoidScores);
    const rerankScoreById = new Map<string, number>();

    orderedCandidates.forEach((candidate, index) => {
      rerankScoreById.set(candidate.id, normalizedScores[index] ?? 0);
    });

    return rerankScoreById;
  }

  private combineHybridAndRerankScores(
    hybridScores: Map<string, number>,
    rerankScores: Map<string, number>
  ): Map<string, number> {
    if (rerankScores.size === 0) {
      return hybridScores;
    }

    const merged = new Map<string, number>();

    for (const [id, hybridScore] of Array.from(hybridScores.entries())) {
      const rerankScore = rerankScores.get(id);

      if (rerankScore == null) {
        merged.set(id, hybridScore);
        continue;
      }

      const finalScore =
        hybridScore * this.vectorHybridWeight +
        rerankScore * this.vectorRerankWeight;

      merged.set(id, this.clamp(finalScore, 0, 1));
    }

    return merged;
  }

  private applyDynamicThreshold(rankedItems: RankedProductItem[]): string[] {
    if (rankedItems.length === 0) {
      return [];
    }

    const topScore = rankedItems[0].score;

    const dynamicThreshold = Math.max(
      this.vectorDynamicThresholdMinScore,
      topScore * this.vectorDynamicThresholdTopRatio,
      topScore - this.vectorDynamicThresholdMaxDrop
    );

    const filtered = rankedItems.filter(
      (item) => item.score >= dynamicThreshold
    );

    const minResults = Math.min(
      this.vectorDynamicThresholdMinResults,
      rankedItems.length
    );

    if (filtered.length >= minResults) {
      return filtered.map((item) => item.id);
    }

    return rankedItems.slice(0, minResults).map((item) => item.id);
  }

  private buildRerankText(product: RerankCandidateProduct): string {
    const sizes = new Set<string>();
    const colors = new Set<string>();

    for (const variant of product.variants ?? []) {
      if (variant.sizeOptionValue?.value) {
        sizes.add(variant.sizeOptionValue.value);
      }

      if (variant.colorOptionValue?.value) {
        colors.add(variant.colorOptionValue.value);
      }
    }

    const styleTags: string[] = (product.styleTags as string[]) || [];

    const parts = [
      product.name,
      product.brand,
      product.category?.name,
      product.shortDescription,
      product.material,
      product.season,
      product.fit,
      product.gender,
      product.season,
      styleTags.length > 0 ? `style tags: ${styleTags.join(', ')}` : null,
      sizes.size > 0 ? `sizes: ${Array.from(sizes).join(', ')}` : null,
      colors.size > 0 ? `colors: ${Array.from(colors).join(', ')}` : null
    ].filter((part): part is string => Boolean(part && part.trim()));

    return parts.join(' | ').slice(0, this.vectorRerankTextMaxLength);
  }

  private normalizeScoreMap(
    scoreById: Map<string, number>
  ): Map<string, number> {
    const normalized = new Map<string, number>();
    const values = Array.from(scoreById.values());

    if (values.length === 0) {
      return normalized;
    }

    const normalizedValues = this.normalizeScores(values);
    let idx = 0;

    for (const [id] of Array.from(scoreById.entries())) {
      normalized.set(id, normalizedValues[idx] ?? 0);
      idx += 1;
    }

    return normalized;
  }

  private normalizeScores(scores: number[]): number[] {
    if (scores.length === 0) {
      return [];
    }

    const min = Math.min(...scores);
    const max = Math.max(...scores);

    if (max - min < Number.EPSILON) {
      return scores.map(() => 1);
    }

    return scores.map((score) => this.clamp((score - min) / (max - min), 0, 1));
  }

  private sigmoid(value: number): number {
    if (value >= 0) {
      const exp = Math.exp(-value);
      return 1 / (1 + exp);
    }

    const exp = Math.exp(value);
    return exp / (1 + exp);
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
        totalVariantStock: summary?.totalVariantStock ?? 0,
        hexColors: summary?.hexColors ?? []
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
        totalVariantStock: row._sum.stock ?? 0,
        hexColors: []
      });
    }

    const variantsColors = await this.prisma.variant.findMany({
      where: { productId: { in: productIds } },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        productId: true,
        colorOptionValue: { select: { hexColor: true } }
      }
    });

    for (const v of variantsColors) {
      if (v.colorOptionValue?.hexColor) {
        const summary = result.get(v.productId);
        if (summary) {
          if (!summary.hexColors) summary.hexColors = [];
          if (!summary.hexColors.includes(v.colorOptionValue.hexColor)) {
            summary.hexColors.push(v.colorOptionValue.hexColor);
          }
        }
      }
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

  async findBestSellers(
    limit: number
  ): Promise<PaginatedData<ProductListItem>> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const topVariants = await this.prisma.orderItem.groupBy({
      by: ['variantId'],
      where: {
        order: {
          status: {
            notIn: ['CANCELED']
          },
          createdAt: {
            gte: sevenDaysAgo
          }
        }
      },
      _sum: {
        quantity: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: limit * 3
    });

    const variantIds = topVariants.map((v) => v.variantId);

    let orderedItems: ProductListItem[] = [];

    if (variantIds.length > 0) {
      const variants = await this.prisma.variant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true }
      });

      const productIdByVariantId = new Map(
        variants.map((variant) => [variant.id, variant.productId])
      );

      const productIdsSet = new Set<string>();
      for (const vId of variantIds) {
        const productId = productIdByVariantId.get(vId);
        if (productId) {
          productIdsSet.add(productId);
        }
      }

      const productIds = Array.from(productIdsSet).slice(0, limit);

      if (productIds.length > 0) {
        const data = await this.prisma.product.findMany({
          where: {
            id: { in: productIds },
            isActive: true
          },
          select: productListSelect
        });

        const itemsWithVariantSummary = await this.attachVariantSummary(data);
        const itemsById = new Map(
          itemsWithVariantSummary.map((item) => [item.id, item])
        );
        orderedItems = productIds
          .map((id) => itemsById.get(id))
          .filter((item): item is ProductListItem => Boolean(item));
      }
    }

    const fallbackTake = Math.max(limit - orderedItems.length, 0);

    if (fallbackTake > 0) {
      const excludeIds = orderedItems.map((item) => item.id);

      const fallbackRows = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM products p
        WHERE p.is_active = TRUE
        ${
          excludeIds.length > 0
            ? Prisma.sql`AND p.id NOT IN (${Prisma.join(excludeIds)})`
            : Prisma.empty
        }
        ORDER BY RANDOM()
        LIMIT ${fallbackTake};
      `;

      const fallbackIds = fallbackRows.map((row) => row.id);

      if (fallbackIds.length > 0) {
        const fallbackData = await this.prisma.product.findMany({
          where: {
            id: { in: fallbackIds },
            isActive: true
          },
          select: productListSelect
        });

        const fallbackItemsWithVariantSummary =
          await this.attachVariantSummary(fallbackData);
        const fallbackItemsById = new Map(
          fallbackItemsWithVariantSummary.map((item) => [item.id, item])
        );
        const orderedFallbackItems = fallbackIds
          .map((id) => fallbackItemsById.get(id))
          .filter((item): item is ProductListItem => Boolean(item));

        orderedItems = [...orderedItems, ...orderedFallbackItems].slice(
          0,
          limit
        );
      }
    }

    return {
      items: orderedItems,
      meta: {
        total: orderedItems.length,
        page: 1,
        limit,
        totalPages: orderedItems.length > 0 ? 1 : 0
      }
    };
  }

  async findRecommendations(
    productId: string,
    categoryId: string | null,
    limit: number
  ): Promise<PaginatedData<ProductListItem>> {
    const where: Prisma.ProductWhereInput = {
      id: { not: productId },
      isActive: true,
      ...(categoryId && { categoryId })
    };

    let data = await this.prisma.product.findMany({
      where,
      select: productListSelect,
      take: limit * 2
    });

    if (data.length < limit) {
      const fallbackWhere: Prisma.ProductWhereInput = {
        id: { not: productId },
        isActive: true
      };

      const excludeIds = data.map((d) => d.id);
      if (excludeIds.length > 0) {
        fallbackWhere.id = { notIn: [productId, ...excludeIds] };
      }

      const fallbackData = await this.prisma.product.findMany({
        where: fallbackWhere,
        select: productListSelect,
        take: limit - data.length
      });
      data = [...data, ...fallbackData];
    }

    const shuffled = data.sort(() => 0.5 - Math.random()).slice(0, limit);

    const items = await this.attachVariantSummary(shuffled);

    return {
      items,
      meta: {
        total: items.length,
        page: 1,
        limit,
        totalPages: 1
      }
    };
  }
}
