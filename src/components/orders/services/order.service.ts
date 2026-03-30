import {
  MAX_CODE_GENERATION_RETRIES,
  ORDER_CODE_OPTIONS,
  PAYMENT_CODE_OPTIONS,
  STATUS_TRANSITIONS
} from '@components/orders/constants/order.constant';
import { CheckoutOrderItemDto } from '@components/orders/dtos/checkout-order-item.dto';
import { CreateOrderDto } from '@components/orders/dtos/create-order.dto';
import { PreviewOrderDto } from '@components/orders/dtos/preview-order.dto';
import { QueryOrderDto } from '@components/orders/dtos/query-order.dto';
import { UpdateOrderStatusDto } from '@components/orders/dtos/update-order-status.dto';
import { OrderRepository } from '@components/orders/repositories/order.repository';
import { ShippingService } from '@components/shipping/services/shipping.serivce';
import { EntityCodeService, PrismaService } from '@core/modules/prisma';
import { VNPayService } from '@core/modules/vnpay';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma
} from '@prisma/client';

type CheckoutCartItem = {
  cartItemId: string;
  variantId: string;
  quantity: number;
  variant: {
    id: string;
    sku: string;
    price: Prisma.Decimal;
    stock: number;
    productId: string;
    product: {
      name: string;
      images?: {
        file: {
          url: string;
        };
      }[];
    };
    colorOptionValue: {
      value: string;
      images?: {
        file: {
          url: string;
        };
      }[];
    };
    sizeOptionValue: {
      value: string;
    };
  };
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepository: OrderRepository,
    private readonly entityCodeService: EntityCodeService,
    private readonly shippingService: ShippingService,
    private readonly vnpayService: VNPayService
  ) {}

  async createFromMyCart(userId: string, dto: CreateOrderDto, ipAddr?: string) {
    const checkoutContext = await this.buildCheckoutContext(
      userId,
      dto.addressId,
      dto.items,
      {
        paymentMethod: dto.paymentMethod
      }
    );

    const {
      user,
      address,
      cart,
      checkoutItems,
      totalProductAmount,
      shippingFee,
      totalAmount
    } = checkoutContext;

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.COD;
    const initialOrderStatus =
      paymentMethod === PaymentMethod.COD
        ? OrderStatus.PAID
        : OrderStatus.PENDING;
    const initialPaymentStatus =
      paymentMethod === PaymentMethod.COD
        ? PaymentStatus.SUCCESS
        : PaymentStatus.PENDING;

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_RETRIES; attempt++) {
      const orderCode =
        await this.entityCodeService.nextCode(ORDER_CODE_OPTIONS);
      const paymentCode =
        await this.entityCodeService.nextCode(PAYMENT_CODE_OPTIONS);

      try {
        const created = await this.prisma.$transaction(async (tx) => {
          for (const item of checkoutItems) {
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
              totalProductAmount,
              shippingFee,
              totalAmount,
              status: initialOrderStatus,
              items: {
                create: checkoutItems.map((item) => ({
                  variantId: item.variantId,
                  quantity: item.quantity,
                  price: item.variant.price,
                  productSnapshot: {
                    productId: item.variant.productId,
                    productName: item.variant.product.name,
                    variantId: item.variant.id,
                    sku: item.variant.sku,
                    size: item.variant.sizeOptionValue.value,
                    color: item.variant.colorOptionValue.value,
                    image:
                      item.variant.colorOptionValue.images?.[0]?.file?.url ||
                      item.variant.product.images?.[0]?.file?.url ||
                      null,
                    unitPrice: new Prisma.Decimal(item.variant.price).toFixed(2)
                  }
                }))
              },
              payment: {
                create: {
                  code: paymentCode,
                  method: paymentMethod,
                  status: initialPaymentStatus,
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

          if (dto.items && dto.items.length > 0) {
            for (const item of checkoutItems) {
              await tx.cartItem.delete({
                where: {
                  id: item.cartItemId
                }
              });
            }
          } else {
            await tx.cartItem.deleteMany({
              where: {
                cartId: cart.id
              }
            });
          }

          return order;
        });

        // Generate VNPay payment URL if payment method is VNPAY
        if (paymentMethod === PaymentMethod.VNPAY && created.payment) {
          const paymentUrl = this.vnpayService.createPaymentUrl({
            ipAddr: ipAddr || '127.0.0.1',
            txnRef: created.payment.code,
            amount: Number(totalAmount),
            orderInfo: `Thanh toan don hang ${orderCode}`
          });

          return { ...created, paymentUrl };
        }

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

  /**
   * Handle VNPay IPN (Instant Payment Notification) callback.
   * This is called server-to-server by VNPay.
   */
  async handleVnpayIpn(
    query: Record<string, string>
  ): Promise<{ RspCode: string; Message: string }> {
    const { isValid, vnpParams } = this.vnpayService.verifySecureHash(query);

    if (!isValid) {
      return { RspCode: '97', Message: 'Invalid signature' };
    }

    const txnRef = vnpParams['vnp_TxnRef'];
    const vnpAmount = Number(vnpParams['vnp_Amount']) / 100;
    const responseCode = vnpParams['vnp_ResponseCode'];
    const transactionStatus = vnpParams['vnp_TransactionStatus'];
    const transactionNo = vnpParams['vnp_TransactionNo'];

    try {
      // Find payment by code (txnRef = payment.code)
      const payment = await this.prisma.payment.findUnique({
        where: { code: txnRef },
        include: { order: true }
      });

      if (!payment) {
        this.logger.warn(`VNPay IPN: Payment not found for txnRef=${txnRef}`);
        return { RspCode: '01', Message: 'Order not found' };
      }

      // Verify amount
      const paymentAmount = Number(payment.amount);
      if (Math.round(paymentAmount) !== Math.round(vnpAmount)) {
        this.logger.warn(
          `VNPay IPN: Amount mismatch for txnRef=${txnRef}. ` +
            `Expected=${paymentAmount}, Got=${vnpAmount}`
        );
        return { RspCode: '04', Message: 'Invalid amount' };
      }

      // Check if already processed (idempotency)
      if (payment.status !== PaymentStatus.PENDING) {
        this.logger.log(
          `VNPay IPN: Payment already confirmed for txnRef=${txnRef}`
        );
        return { RspCode: '02', Message: 'Order already confirmed' };
      }

      // Update payment and order status based on VNPay response
      const isSuccess = responseCode === '00' && transactionStatus === '00';

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: isSuccess ? PaymentStatus.SUCCESS : PaymentStatus.FAILED,
            providerTransactionId: transactionNo || undefined
          }
        });

        if (isSuccess) {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.PAID }
          });
        } else {
          // Restore stock on failed payment
          const orderItems = await tx.orderItem.findMany({
            where: { orderId: payment.orderId }
          });

          for (const item of orderItems) {
            await tx.variant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } }
            });
          }

          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: OrderStatus.CANCELED }
          });
        }
      });

      this.logger.log(
        `VNPay IPN: Payment ${isSuccess ? 'SUCCESS' : 'FAILED'} ` +
          `for txnRef=${txnRef}, transactionNo=${transactionNo}`
      );

      return { RspCode: '00', Message: 'Confirm Success' };
    } catch (error) {
      this.logger.error(`VNPay IPN: Error processing txnRef=${txnRef}`, error);
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  /**
   * Handle VNPay ReturnURL callback.
   * Verifies the signature and returns payment result info for the frontend.
   */
  handleVnpayReturn(query: Record<string, string>) {
    const { isValid, vnpParams } = this.vnpayService.verifySecureHash(query);

    if (!isValid) {
      return {
        success: false,
        message: 'Chữ ký không hợp lệ'
      };
    }

    const responseCode = vnpParams['vnp_ResponseCode'];
    const isSuccess = responseCode === '00';

    return {
      success: isSuccess,
      message: isSuccess
        ? 'Giao dịch thành công'
        : `Giao dịch không thành công. Mã lỗi: ${responseCode}`,
      data: {
        txnRef: vnpParams['vnp_TxnRef'],
        amount: Number(vnpParams['vnp_Amount']) / 100,
        orderInfo: vnpParams['vnp_OrderInfo'],
        transactionNo: vnpParams['vnp_TransactionNo'],
        bankCode: vnpParams['vnp_BankCode'],
        payDate: vnpParams['vnp_PayDate'],
        responseCode
      }
    };
  }

  async previewOrder(userId: string, dto: PreviewOrderDto) {
    const { checkoutItems, totalProductAmount, shippingFee, totalAmount } =
      await this.buildCheckoutContext(userId, dto.addressId, dto.items, {
        paymentMethod: dto.paymentMethod
      });

    return {
      totalProductAmount: totalProductAmount.toFixed(2),
      shippingFee: shippingFee.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      items: checkoutItems.map((item) => {
        const unitPrice = new Prisma.Decimal(item.variant.price);

        return {
          variantId: item.variantId,
          sku: item.variant.sku,
          productId: item.variant.productId,
          productName: item.variant.product.name,
          size: item.variant.sizeOptionValue.value,
          color: item.variant.colorOptionValue.value,
          image:
            item.variant.colorOptionValue.images?.[0]?.file?.url ||
            item.variant.product.images?.[0]?.file?.url ||
            null,
          quantity: item.quantity,
          unitPrice: unitPrice.toFixed(2),
          lineAmount: unitPrice.mul(item.quantity).toFixed(2)
        };
      })
    };
  }

  private async buildCheckoutContext(
    userId: string,
    addressId: string,
    requestedItems?: CheckoutOrderItemDto[],
    options?: {
      paymentMethod?: PaymentMethod;
    }
  ) {
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
        id: addressId,
        userId
      }
    });

    if (!address) {
      throw new NotFoundException(
        `Không tìm thấy địa chỉ giao hàng với id ${addressId}`
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
                product: {
                  include: {
                    images: {
                      where: { isPrimary: true },
                      include: { file: true }
                    }
                  }
                },
                colorOptionValue: {
                  include: {
                    images: {
                      take: 1,
                      include: { file: true }
                    }
                  }
                },
                sizeOptionValue: true
              }
            }
          }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      throw new ConflictException('Giỏ hàng trống, không thể tạo đơn hàng');
    }

    let checkoutItems: CheckoutCartItem[] = cart.items.map((item) => ({
      cartItemId: item.id,
      variantId: item.variantId,
      quantity: item.quantity,
      variant: item.variant
    }));

    if (requestedItems && requestedItems.length > 0) {
      const cartItemIds = requestedItems.map((item) => item.cartItemId);
      const duplicateCount = cartItemIds.length - new Set(cartItemIds).size;
      if (duplicateCount > 0) {
        throw new ConflictException(
          'Danh sách sản phẩm thanh toán chứa cart item bị trùng'
        );
      }

      const cartItemById = new Map(cart.items.map((item) => [item.id, item]));

      checkoutItems = requestedItems.map((item) => {
        const cartItem = cartItemById.get(item.cartItemId);
        if (!cartItem) {
          throw new ConflictException(
            `Cart item ${item.cartItemId} không tồn tại trong giỏ hàng`
          );
        }

        return {
          cartItemId: cartItem.id,
          variantId: cartItem.variantId,
          quantity: cartItem.quantity,
          variant: cartItem.variant
        };
      });
    }

    for (const item of checkoutItems) {
      if (item.variant.stock < item.quantity) {
        throw new ConflictException(
          `Biến thể ${item.variant.sku} không đủ tồn kho để đặt hàng`
        );
      }
    }

    const totalProductAmount = checkoutItems.reduce(
      (sum, item) =>
        sum.plus(new Prisma.Decimal(item.variant.price).mul(item.quantity)),
      new Prisma.Decimal(0)
    );

    const shippingFee = await this.calculateShippingFee(
      {
        districtId: address.districtId,
        wardCode: address.wardCode
      },
      totalProductAmount,
      options?.paymentMethod
    );

    return {
      user,
      address,
      cart,
      checkoutItems,
      totalProductAmount,
      shippingFee,
      totalAmount: totalProductAmount.plus(shippingFee)
    };
  }

  private async calculateShippingFee(
    address: {
      districtId: number | null;
      wardCode: string | null;
    },
    totalProductAmount: Prisma.Decimal,
    paymentMethod?: PaymentMethod
  ): Promise<Prisma.Decimal> {
    if (!address.districtId || !address.wardCode) {
      return new Prisma.Decimal(0);
    }

    try {
      const codValue =
        paymentMethod === PaymentMethod.COD
          ? Number(totalProductAmount.toFixed(0))
          : 0;

      const shippingData = await this.shippingService.getShippingFee({
        insuranceValue: Number(totalProductAmount.toFixed(0)),
        toDistrictId: String(address.districtId),
        toWardCode: String(address.wardCode),
        codValue,
        serviceTypeId: 2,
        serviceId: 0
      });

      const rawFee =
        (shippingData as { total?: unknown })?.total ??
        (shippingData as { service_fee?: unknown })?.service_fee ??
        (shippingData as { total_fee?: unknown })?.total_fee ??
        0;

      const normalizedFee = Number(rawFee);
      if (!Number.isFinite(normalizedFee) || normalizedFee < 0) {
        return new Prisma.Decimal(30000);
      }

      return new Prisma.Decimal(normalizedFee);
    } catch {
      return new Prisma.Decimal(30000);
    }
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
