import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { ChatbotToolCatalogService } from '@components/chatbot/services/chatbot-tool-catalog.service';
import { PrismaService } from '@core/modules/prisma';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChatbotToolExecutorService {
  constructor(
    private readonly toolCatalogService: ChatbotToolCatalogService,
    private readonly prisma: PrismaService
  ) {}

  execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    if (name === 'search_products') {
      return this.executeSearchProducts(args, context);
    }

    const tool = this.toolCatalogService.getToolByName(name);

    if (!tool) {
      return Promise.resolve({
        ok: false,
        data: null,
        error: {
          code: 'UNKNOWN_TOOL',
          message: `Tool ${name} is not registered`
        }
      });
    }

    if (tool.requiresAuth && !context.userId) {
      return Promise.resolve({
        ok: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: `Tool ${name} requires authenticated user`
        }
      });
    }

    return Promise.resolve({
      ok: true,
      data: {
        tool: name,
        args,
        note: 'Tool execution stub. Integrate with domain services next.'
      },
      error: null
    });
  }

  private async executeSearchProducts(
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const page = this.toPositiveInt(args.page, 1);
    const limit = Math.min(this.toPositiveInt(args.limit, 12), 50);
    const keyword = this.toOptionalString(args.keyword);
    const categoryNames = this.toStringArray(args.category_names);
    const brands = this.toStringArray(args.brands);
    const materials = this.toStringArray(args.materials);
    const seasons = this.toStringArray(args.seasons);
    const fits = this.toStringArray(args.fits);
    const sizes = this.toStringArray(args.sizes);
    const colors = this.toStringArray(args.colors);
    const skus = this.toStringArray(args.skus);
    const minPrice = this.toOptionalNumber(args.min_price);
    const maxPrice = this.toOptionalNumber(args.max_price);
    const minStock = this.toOptionalNumber(args.min_stock);
    const inStockOnly = this.toOptionalBoolean(args.in_stock_only) ?? true;
    const isActive = this.toOptionalBoolean(args.is_active);
    const gender = this.toOptionalString(args.gender);

    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'max_price must be greater than or equal to min_price'
        }
      };
    }

    const where: Prisma.ProductWhereInput = {
      ...(isActive == null ? { isActive: true } : { isActive })
    };

    const and: Prisma.ProductWhereInput[] = [];

    if (keyword) {
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

    return {
      ok: true,
      data: {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      },
      error: null,
      meta: {
        source: 'prisma.product',
        latencyMs: Date.now() - startedAt
      }
    };
  }

  private toOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private toOptionalBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }

    return undefined;
  }

  private toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  }

  private toPositiveInt(value: unknown, fallback: number): number {
    const parsed = this.toOptionalNumber(value);
    if (parsed == null) {
      return fallback;
    }

    const rounded = Math.floor(parsed);
    if (rounded < 1) {
      return fallback;
    }

    return rounded;
  }
}
