import {
  MAX_CODE_GENERATION_RETRIES,
  ORDER_CODE_OPTIONS,
  PAYMENT_CODE_OPTIONS,
  STATUS_TRANSITIONS
} from '@components/orders/constants/order.constant';
import { CreateOrderDto } from '@components/orders/dtos/create-order.dto';
import { QueryOrderDto } from '@components/orders/dtos/query-order.dto';
import { UpdateOrderStatusDto } from '@components/orders/dtos/update-order-status.dto';
import { OrderRepository } from '@components/orders/repositories/order.repository';
import { EntityCodeService, PrismaService } from '@core/modules/prisma';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma
} from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepository: OrderRepository,
    private readonly entityCodeService: EntityCodeService
  ) {}

  async createFromMyCart(userId: string, dto: CreateOrderDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        code: true,
        fullname: true,
        email: true
      }
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với id ${userId}`);
    }

    const address = await this.prisma.address.findFirst({
      where: {
        id: dto.addressId,
        userId
      }
    });

    if (!address) {
      throw new NotFoundException(
        `Không tìm thấy địa chỉ giao hàng với id ${dto.addressId}`
      );
    }

    const cart = await this.prisma.cart.findUnique({
      where: {
        userId
      },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new ConflictException('Giỏ hàng trống, không thể tạo đơn hàng');
    }

    for (const item of cart.items) {
      if (item.variant.stock < item.quantity) {
        throw new ConflictException(
          `Biến thể ${item.variant.sku} không đủ tồn kho để đặt hàng`
        );
      }
    }

    const totalAmount = cart.items.reduce(
      (sum, item) =>
        sum.plus(new Prisma.Decimal(item.variant.price).mul(item.quantity)),
      new Prisma.Decimal(0)
    );

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.COD;

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_RETRIES; attempt++) {
      const orderCode =
        await this.entityCodeService.nextCode(ORDER_CODE_OPTIONS);
      const paymentCode =
        await this.entityCodeService.nextCode(PAYMENT_CODE_OPTIONS);

      try {
        const created = await this.prisma.$transaction(async (tx) => {
          for (const item of cart.items) {
            const updatedStock = await tx.variant.updateMany({
              where: {
                id: item.variantId,
                stock: {
                  gte: item.quantity
                }
              },
              data: {
                stock: {
                  decrement: item.quantity
                }
              }
            });

            if (updatedStock.count === 0) {
              throw new ConflictException(
                `Biến thể ${item.variant.sku} đã hết hàng hoặc không đủ tồn kho`
              );
            }
          }

          const order = await tx.order.create({
            data: {
              code: orderCode,
              userId,
              userSnapshot: {
                id: user.id,
                code: user.code,
                fullname: user.fullname,
                email: user.email
              },
              shippingAddress: {
                id: address.id,
                fullname: address.fullname,
                phone: address.phone,
                provinceId: address.provinceId,
                provinceName: address.provinceName,
                districtId: address.districtId,
                districtName: address.districtName,
                wardCode: address.wardCode,
                wardName: address.wardName,
                street: address.street
              },
              totalAmount,
              items: {
                create: cart.items.map((item) => ({
                  variantId: item.variantId,
                  quantity: item.quantity,
                  price: item.variant.price,
                  productSnapshot: {
                    productId: item.variant.productId,
                    productName: item.variant.product.name,
                    variantId: item.variant.id,
                    sku: item.variant.sku,
                    size: item.variant.size,
                    color: item.variant.color,
                    unitPrice: new Prisma.Decimal(item.variant.price).toFixed(2)
                  }
                }))
              },
              payment: {
                create: {
                  code: paymentCode,
                  method: paymentMethod,
                  status: PaymentStatus.PENDING,
                  amount: totalAmount
                }
              }
            },
            include: {
              items: {
                include: {
                  variant: {
                    include: {
                      product: true
                    }
                  }
                }
              },
              payment: true
            }
          });

          await tx.cartItem.deleteMany({
            where: {
              cartId: cart.id
            }
          });

          return order;
        });

        return created;
      } catch (error) {
        if (!this.isCodeConflictError(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException(
      'Không thể tạo mã đơn hàng tự động. Vui lòng thử lại.'
    );
  }

  async findMyOrders(userId: string) {
    return this.orderRepository.findByUserId(userId);
  }

  async findMyOrderById(id: string, userId: string) {
    const order = await this.orderRepository.findOneByIdAndUserId(id, userId);

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    return order;
  }

  async findAllForAdmin(query: QueryOrderDto) {
    return this.orderRepository.findAllForAdmin(query);
  }

  async findByIdForAdmin(id: string) {
    const order = await this.orderRepository.findOneById(id);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    return order;
  }

  async updateStatusForAdmin(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    const currentStatus = order.status;
    const nextStatus = dto.status;

    if (currentStatus !== nextStatus) {
      const allowedNextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
      if (!allowedNextStatuses.includes(nextStatus)) {
        throw new ForbiddenException(
          `Không thể chuyển trạng thái từ ${currentStatus} sang ${nextStatus}`
        );
      }
    }

    const derivedPaymentStatus = this.resolvePaymentStatus(
      nextStatus,
      dto.paymentStatus,
      order.payment?.status
    );

    await this.prisma.$transaction(async (tx) => {
      if (
        currentStatus !== OrderStatus.CANCELED &&
        nextStatus === OrderStatus.CANCELED
      ) {
        for (const item of order.items) {
          await tx.variant.update({
            where: {
              id: item.variantId
            },
            data: {
              stock: {
                increment: item.quantity
              }
            }
          });
        }
      }

      await tx.order.update({
        where: {
          id
        },
        data: {
          status: nextStatus
        }
      });

      if (order.payment) {
        await tx.payment.update({
          where: {
            orderId: id
          },
          data: {
            status: derivedPaymentStatus
          }
        });
      }
    });

    const updated = await this.orderRepository.findOneById(id);
    if (!updated) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    return updated;
  }

  private resolvePaymentStatus(
    orderStatus: OrderStatus,
    requestedPaymentStatus: PaymentStatus | undefined,
    currentPaymentStatus: PaymentStatus | undefined
  ): PaymentStatus {
    if (requestedPaymentStatus) {
      return requestedPaymentStatus;
    }

    if (orderStatus === OrderStatus.PAID) {
      return PaymentStatus.SUCCESS;
    }

    if (orderStatus === OrderStatus.CANCELED) {
      return PaymentStatus.FAILED;
    }

    return currentPaymentStatus ?? PaymentStatus.PENDING;
  }

  private isCodeConflictError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('code');
    }

    return typeof target === 'string' ? target.includes('code') : false;
  }
}
