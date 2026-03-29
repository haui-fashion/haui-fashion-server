import {
  toOptionalBoolean,
  toOptionalNumber,
  toOptionalString,
  toPositiveInt,
  toStringArray
} from '@common/helpers/util.helper';
import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { EmbeddingService } from '@core/modules/embedding';
import { PrismaService } from '@core/modules/prisma';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class SearchProductsHandler {
  private readonly logger = new Logger(SearchProductsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService
  ) {}

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const page = toPositiveInt(args.page, 1);
    const limit = Math.min(toPositiveInt(args.limit, 12), 30);
    const keyword = toOptionalString(args.keyword);
    const categoryNames = toStringArray(args.category_names);
    const brands = toStringArray(args.brands);
    const materials = toStringArray(args.materials);
    const seasons = toStringArray(args.seasons);
    const fits = toStringArray(args.fits);
    const sizes = toStringArray(args.sizes);
    const colors = toStringArray(args.colors);
    const skus = toStringArray(args.skus);
    const minPrice = toOptionalNumber(args.min_price);
    const maxPrice = toOptionalNumber(args.max_price);
    const minStock = toOptionalNumber(args.min_stock);
    const inStockOnly = toOptionalBoolean(args.in_stock_only) ?? true;
    const isActive = toOptionalBoolean(args.is_active);
    const gender = toOptionalString(args.gender);

    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'max_price phải lớn hơn hoặc bằng min_price',
          suggestion: 'Hãy kiểm tra lại khoảng giá.'
        }
      };
    }

    let semanticProductIds: string[] | null = null;

    if (keyword) {
      try {
        const queryEmbedding = await this.embeddingService.embedQuery(keyword);
        const vectorLiteral = `[${queryEmbedding.join(',')}]`;

        const semanticResults = await this.prisma.$queryRaw<
          Array<{ product_id: string; similarity: number }>
        >`
          SELECT pe.product_id, 1 - (pe.embedding_vector <=> ${vectorLiteral}::vector) AS similarity
          FROM product_embeddings pe
          WHERE pe.is_active = true
            AND pe.status = 'SYNCED'
          ORDER BY pe.embedding_vector <=> ${vectorLiteral}::vector ASC
          LIMIT 50
        `;

        if (semanticResults.length > 0) {
          semanticProductIds = semanticResults.map((r) => r.product_id);
        }
      } catch (error) {
        this.logger.warn(
          `Semantic search failed, falling back to lexical: ${(error as Error).message}`
        );
      }
    }

    const where: Prisma.ProductWhereInput = {
      ...(isActive == null ? { isActive: true } : { isActive })
    };

    const and: Prisma.ProductWhereInput[] = [];

    if (semanticProductIds) {
      and.push({ id: { in: semanticProductIds } });
    } else if (keyword) {
      and.push({
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { slug: { contains: keyword, mode: 'insensitive' } },
          { brand: { contains: keyword, mode: 'insensitive' } },
          { shortDescription: { contains: keyword, mode: 'insensitive' } },
          { descriptionHtml: { contains: keyword, mode: 'insensitive' } }
        ]
      });
    }

    if (categoryNames.length > 0) {
      and.push({
        OR: categoryNames.map((categoryName) => ({
          category: {
            name: { contains: categoryName, mode: 'insensitive' }
          }
        }))
      });
    }

    if (brands.length > 0) {
      and.push({
        OR: brands.map((brand) => ({
          brand: { contains: brand, mode: 'insensitive' }
        }))
      });
    }

    if (materials.length > 0) {
      and.push({
        OR: materials.map((material) => ({
          material: { contains: material, mode: 'insensitive' }
        }))
      });
    }

    if (seasons.length > 0) {
      and.push({
        OR: seasons.map((season) => ({
          season: { contains: season, mode: 'insensitive' }
        }))
      });
    }

    if (fits.length > 0) {
      and.push({
        OR: fits.map((fit) => ({
          fit: { contains: fit, mode: 'insensitive' }
        }))
      });
    }

    if (gender && ['MALE', 'FEMALE', 'UNISEX'].includes(gender)) {
      and.push({
        gender: gender as 'MALE' | 'FEMALE' | 'UNISEX'
      });
    }

    const variantWhere: Prisma.VariantWhereInput = {};
    const variantAnd: Prisma.VariantWhereInput[] = [];

    if (skus.length > 0) {
      variantWhere.sku = { in: skus };
    }

    if (minPrice != null || maxPrice != null) {
      variantWhere.price = {
        ...(minPrice != null && { gte: minPrice }),
        ...(maxPrice != null && { lte: maxPrice })
      };
    }

    if (inStockOnly) {
      variantWhere.stock = { gt: 0 };
    } else if (minStock != null) {
      variantWhere.stock = { gte: minStock };
    }

    if (sizes.length > 0) {
      variantAnd.push({
        OR: sizes.map((size) => ({
          sizeOptionValue: {
            value: {
              equals: size,
              mode: 'insensitive'
            }
          }
        }))
      });
    }

    if (colors.length > 0) {
      variantAnd.push({
        OR: colors.map((color) => ({
          colorOptionValue: {
            value: {
              equals: color,
              mode: 'insensitive'
            }
          }
        }))
      });
    }

    if (variantAnd.length > 0) {
      variantWhere.AND = variantAnd;
    }

    if (Object.keys(variantWhere).length > 0) {
      and.push({
        variants: {
          some: variantWhere
        }
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        ...(semanticProductIds && {
          orderBy: undefined
        }),
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          variants: {
            where:
              Object.keys(variantWhere).length > 0 ? variantWhere : undefined,
            select: {
              id: true,
              sku: true,
              price: true,
              stock: true,
              colorOptionValue: {
                select: {
                  id: true,
                  value: true,
                  hexColor: true
                }
              },
              sizeOptionValue: {
                select: {
                  id: true,
                  value: true
                }
              }
            },
            take: 20,
            orderBy: {
              createdAt: 'desc'
            }
          },
          images: {
            include: {
              file: {
                select: {
                  id: true,
                  url: true
                }
              }
            },
            take: 3,
            orderBy: [
              {
                isPrimary: 'desc'
              },
              {
                position: 'asc'
              }
            ]
          }
        }
      }),
      this.prisma.product.count({ where })
    ]);

    const orderedItems = semanticProductIds
      ? (() => {
          const ids = semanticProductIds;
          return items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        })()
      : items;

    return {
      ok: true,
      data: {
        items: orderedItems,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          searchMethod: semanticProductIds ? 'semantic' : 'lexical'
        }
      },
      error: null,
      meta: {
        source: 'prisma.product',
        latencyMs: Date.now() - startedAt
      }
    };
  }
}
