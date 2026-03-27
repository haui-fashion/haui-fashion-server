import {
  resolveOrderSort,
  toOptionalNumber,
  toOptionalString,
  toPositiveInt
} from '@common/helpers/util.helper';
import {
  ToolExecutionContext,
  ToolExecutionResult
} from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { PrismaService } from '@core/modules/prisma';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class GetListOrdersHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const page = toPositiveInt(args.page, 1);
    const limit = Math.min(toPositiveInt(args.limit, 10), 20);
    const status = toOptionalString(args.status);
    const paymentMethod = toOptionalString(args.payment_method);
    const paymentStatus = toOptionalString(args.payment_status);
    const minTotal = toOptionalNumber(args.min_total_amount);
    const maxTotal = toOptionalNumber(args.max_total_amount);
    const fromDate = toOptionalString(args.from_date);
    const toDate = toOptionalString(args.to_date);
    const sortBy = toOptionalString(args.sort_by) || 'created_at_desc';

    const where: Prisma.OrderWhereInput = {
      userId: context.userId
    };

    if (status) {
      where.status = status as any;
    }

    if (minTotal != null || maxTotal != null) {
      where.totalAmount = {
        ...(minTotal != null && { gte: minTotal }),
        ...(maxTotal != null && { lte: maxTotal })
      };
    }

    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate && { gte: new Date(fromDate) }),
        ...(toDate && { lte: new Date(toDate) })
      };
    }

    if (paymentMethod || paymentStatus) {
      where.payment = {
        ...(paymentMethod && { method: paymentMethod as any }),
        ...(paymentStatus && { status: paymentStatus as any })
      };
    }

    const orderBy = resolveOrderSort(sortBy);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          code: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          payment: {
            select: {
              method: true,
              status: true
            }
          },
          items: {
            select: {
              quantity: true,
              price: true,
              productSnapshot: true
            }
          }
        }
      }),
      this.prisma.order.count({ where })
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
        source: 'prisma.order',
        latencyMs: Date.now() - startedAt
      }
    };
  }
}
