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
export class CheckOrderStatusHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startedAt = Date.now();
    const orderId = toOptionalString(args.order_id);
    const orderCode = toOptionalString(args.order_code);
    const includeItems = toOptionalBoolean(args.include_items) ?? true;
    const includePayment = toOptionalBoolean(args.include_payment) ?? true;

    if (!orderId && !orderCode) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Phải cung cấp order_id hoặc order_code',
          suggestion: 'Hãy cung cấp mã đơn hàng hoặc ID đơn hàng để tra cứu.'
        }
      };
    }

    const orderWhere: Prisma.OrderWhereInput = {
      userId: context.userId,
      ...(orderId ? { id: orderId } : { code: orderCode })
    };

    if (args.status) {
      orderWhere.status = toOptionalString(args.status) as any;
    }

    const order = await this.prisma.order.findFirst({
      where: orderWhere,
      include: {
        ...(includeItems && {
          items: {
            select: {
              id: true,
              productSnapshot: true,
              quantity: true,
              price: true,
              variant: {
                select: {
                  sku: true,
                  colorOptionValue: {
                    select: { value: true, hexColor: true }
                  },
                  sizeOptionValue: {
                    select: { value: true }
                  }
                }
              }
            }
          }
        }),
        ...(includePayment && {
          payment: {
            select: {
              id: true,
              code: true,
              method: true,
              status: true,
              amount: true,
              createdAt: true
            }
          }
        })
      }
    });

    if (!order) {
      return {
        ok: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Order not found',
          suggestion:
            'Không tìm thấy đơn hàng. Hãy kiểm tra lại mã đơn hoặc đảm bảo đã đăng nhập đúng tài khoản.'
        }
      };
    }

    return {
      ok: true,
      data: {
        id: order.id,
        code: order.code,
        status: order.status,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        ...(includeItems && { items: order.items }),
        ...(includePayment && { payment: order.payment })
      },
      error: null,
      meta: {
        source: 'prisma.order',
        latencyMs: Date.now() - startedAt
      }
    };
  }
}
