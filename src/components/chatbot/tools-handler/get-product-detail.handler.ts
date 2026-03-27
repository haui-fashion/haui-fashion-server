import {
  toOptionalBoolean,
  toOptionalString
} from '@common/helpers/util.helper';
import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { PrismaService } from '@core/modules/prisma';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class GetProductDetailHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const productId = toOptionalString(args.product_id);
    const productSlug = toOptionalString(args.product_slug);
    const includeVariants = toOptionalBoolean(args.include_variants) ?? true;
    const includeReviews = toOptionalBoolean(args.include_reviews) ?? false;
    const variantSize = toOptionalString(args.variant_size);
    const variantColor = toOptionalString(args.variant_color);

    if (!productId && !productSlug) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Phải cung cấp product_id hoặc product_slug',
          suggestion: 'Hãy cung cấp ID hoặc slug của sản phẩm cần xem chi tiết.'
        }
      };
    }

    const productWhere: Prisma.ProductWhereInput = {
      isActive: true,
      ...(productId ? { id: productId } : { slug: productSlug })
    };

    const variantFilter: Prisma.VariantWhereInput = {};
    const variantFilterAnd: Prisma.VariantWhereInput[] = [];
    if (variantSize) {
      variantFilterAnd.push({
        sizeOptionValue: {
          value: { equals: variantSize, mode: 'insensitive' }
        }
      });
    }
    if (variantColor) {
      variantFilterAnd.push({
        colorOptionValue: {
          value: { equals: variantColor, mode: 'insensitive' }
        }
      });
    }
    if (variantFilterAnd.length > 0) {
      variantFilter.AND = variantFilterAnd;
    }

    const product = await this.prisma.product.findFirst({
      where: productWhere,
      include: {
        category: {
          select: { id: true, name: true, slug: true }
        },
        ...(includeVariants && {
          variants: {
            where:
              Object.keys(variantFilter).length > 0 ? variantFilter : undefined,
            select: {
              id: true,
              sku: true,
              price: true,
              stock: true,
              colorOptionValue: {
                select: { id: true, value: true, hexColor: true }
              },
              sizeOptionValue: {
                select: { id: true, value: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }),
        images: {
          include: {
            file: {
              select: { id: true, url: true }
            }
          },
          take: 10,
          orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }]
        },
        ...(includeReviews && {
          reviews: {
            select: {
              id: true,
              star: true,
              content: true,
              createdAt: true,
              user: {
                select: { fullname: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        })
      }
    });

    if (!product) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found',
          suggestion:
            'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh. Hãy thử tìm kiếm sản phẩm khác.'
        }
      };
    }

    return {
      ok: true,
      data: product,
      error: null,
      meta: {
        source: 'prisma.product',
        latencyMs: Date.now() - startedAt
      }
    };
  }
}
