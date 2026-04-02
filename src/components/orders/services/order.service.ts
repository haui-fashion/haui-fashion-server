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
import { ShippingService } from '@components/shipping/services/shipping.service';
import { MailService } from '@core/modules/mail/services/mail.service';
import { MoMoIpnBody, MoMoService } from '@core/modules/momo';
import { EntityCodeService, PrismaService } from '@core/modules/prisma';
import { VNPayService } from '@core/modules/vnpay';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma
} from '@prisma/client';

const ONLINE_PAYMENT_TTL_HOURS = 1;
const ORDER_DETAIL_URL_BASE = 'https://www.hauifashion.com/order';
const ORDER_ITEM_PLACEHOLDER_IMAGE = 'https://placehold.co/80x80?text=No+Image';
const ORDER_CANCELED_BY_ADMIN_LABEL = 'Quản trị viên';
const ORDER_CANCELED_BY_SYSTEM_LABEL = 'Hệ thống';

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
      isActive: boolean;
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

type OrderEmailItem = {
  name: string;
  sku: string;
  image: string;
  price: number;
  quantity: number;
  total: number;
};

type OrderEmailPayload = {
  id: string;
  code: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  shippingAddress: {
    fullname: string;
    phone: string;
    street: string;
    wardName: string;
    districtName: string;
    provinceName: string;
  };
  items: OrderEmailItem[];
  totalProductAmount: number;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
};

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderRepository: OrderRepository,
    private readonly entityCodeService: EntityCodeService,
    private readonly mailService: MailService,
    private readonly shippingService: ShippingService,
    private readonly vnpayService: VNPayService,
    private readonly momoService: MoMoService
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
        ? OrderStatus.TO_DELIVERY
        : OrderStatus.PENDING;
    const initialPaymentStatus =
      paymentMethod === PaymentMethod.COD
        ? PaymentStatus.PENDING
        : PaymentStatus.PENDING;

    for (let attempt = 0; attempt < MAX_CODE_GENERATION_RETRIES; attempt++) {
      const orderCode =
        await this.entityCodeService.nextCode(ORDER_CODE_OPTIONS);
      const paymentCode =
        await this.entityCodeService.nextCode(PAYMENT_CODE_OPTIONS);

      try {
        const created = await this.prisma.$transaction(async (tx) => {
          const stockLockItems = [...checkoutItems].sort((a, b) =>
            a.variantId.localeCompare(b.variantId)
          );

          for (const item of stockLockItems) {
            const updatedStock = await tx.variant.updateMany({
              where: {
                id: item.variantId,
                product: {
                  is: {
                    isActive: true
                  }
                },
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
                `Biến thể ${item.variant.sku} đã ngừng bán, hết hàng hoặc không đủ tồn kho`
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
              items: true,
              payment: true
            }
          });

          if (dto.items && dto.items.length > 0) {
            await tx.cartItem.deleteMany({
              where: {
                id: {
                  in: checkoutItems.map((item) => item.cartItemId)
                },
                cartId: cart.id
              }
            });
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

          await this.sendOrderCreatedEmail(created.id);

          return { ...created, paymentUrl };
        }

        // Generate MoMo payment URL if payment method is MOMO
        if (paymentMethod === PaymentMethod.MOMO && created.payment) {
          const paymentUrl = await this.momoService.createPaymentUrl({
            txnRef: created.payment.code,
            amount: Number(totalAmount),
            orderInfo: `Thanh toan don hang ${orderCode}`
          });

          await this.sendOrderCreatedEmail(created.id);

          return { ...created, paymentUrl };
        }

        await this.sendOrderCreatedEmail(created.id);

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

      if (
        payment.status !== PaymentStatus.PENDING ||
        payment.order.status !== OrderStatus.PENDING
      ) {
        this.logger.log(
          `VNPay IPN: Order already processed for txnRef=${txnRef}, ` +
            `orderStatus=${payment.order.status}, paymentStatus=${payment.status}`
        );
        return { RspCode: '02', Message: 'Order already processed' };
      }

      const paymentDeadline = this.getOnlinePaymentDeadline(payment.createdAt);
      if (new Date() > paymentDeadline) {
        const canceled = await this.prisma.$transaction(async (tx) => {
          return this.failOrderAndRestoreStock(tx, payment.orderId, {
            providerTransactionId: transactionNo || undefined
          });
        });

        if (canceled) {
          await this.sendOrderCanceledEmail(
            payment.orderId,
            this.getOnlinePaymentExpiredReason(),
            ORDER_CANCELED_BY_SYSTEM_LABEL
          );
        }

        this.logger.warn(
          `VNPay IPN: Payment expired for txnRef=${txnRef}, deadline=${paymentDeadline.toISOString()}`
        );
        return { RspCode: '02', Message: 'Order expired' };
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

      // Update payment and order status based on VNPay response
      const isSuccess = responseCode === '00' && transactionStatus === '00';

      const handled = await this.prisma.$transaction(async (tx) => {
        if (isSuccess) {
          return this.markOrderPaidFromPending(
            tx,
            payment.id,
            payment.orderId,
            {
              providerTransactionId: transactionNo || undefined
            }
          );
        }

        return this.failOrderAndRestoreStock(tx, payment.orderId, {
          providerTransactionId: transactionNo || undefined
        });
      });

      if (!handled) {
        this.logger.log(
          `VNPay IPN: Skip because order is not pending anymore for txnRef=${txnRef}`
        );
        return { RspCode: '02', Message: 'Order already processed' };
      }

      this.logger.log(
        `VNPay IPN: Payment ${isSuccess ? 'SUCCESS' : 'FAILED'} ` +
          `for txnRef=${txnRef}, transactionNo=${transactionNo}`
      );

      if (isSuccess) {
        await this.sendPaymentSuccessEmail(payment.orderId);
      }

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

  /**
   * Handle MoMo IPN (Instant Payment Notification) callback.
   * This is called server-to-server by MoMo via POST with JSON body.
   * Must respond with HTTP 204 No Content.
   */
  async handleMomoIpn(body: MoMoIpnBody): Promise<void> {
    const { isValid } = this.momoService.verifyIpnSignature(body);

    if (!isValid) {
      this.logger.warn(
        `MoMo IPN: Invalid signature for orderId=${body.orderId}`
      );
      return;
    }

    const txnRef = body.orderId;
    const momoAmount = body.amount;
    const resultCode = body.resultCode;
    const transId = String(body.transId);

    try {
      const payment = await this.prisma.payment.findUnique({
        where: { code: txnRef },
        include: { order: true }
      });

      if (!payment) {
        this.logger.warn(`MoMo IPN: Payment not found for orderId=${txnRef}`);
        return;
      }

      if (
        payment.status !== PaymentStatus.PENDING ||
        payment.order.status !== OrderStatus.PENDING
      ) {
        this.logger.log(
          `MoMo IPN: Order already processed for orderId=${txnRef}, ` +
            `orderStatus=${payment.order.status}, paymentStatus=${payment.status}`
        );
        return;
      }

      const paymentDeadline = this.getOnlinePaymentDeadline(payment.createdAt);
      if (new Date() > paymentDeadline) {
        const canceled = await this.prisma.$transaction(async (tx) => {
          return this.failOrderAndRestoreStock(tx, payment.orderId, {
            providerTransactionId: transId
          });
        });

        if (canceled) {
          await this.sendOrderCanceledEmail(
            payment.orderId,
            this.getOnlinePaymentExpiredReason(),
            ORDER_CANCELED_BY_SYSTEM_LABEL
          );
        }

        this.logger.warn(
          `MoMo IPN: Payment expired for orderId=${txnRef}, deadline=${paymentDeadline.toISOString()}`
        );
        return;
      }

      // Verify amount
      const paymentAmount = Number(payment.amount);
      if (Math.round(paymentAmount) !== Math.round(momoAmount)) {
        this.logger.warn(
          `MoMo IPN: Amount mismatch for orderId=${txnRef}. ` +
            `Expected=${paymentAmount}, Got=${momoAmount}`
        );
        return;
      }

      // resultCode === 0 means success in MoMo
      const isSuccess = resultCode === 0;

      const handled = await this.prisma.$transaction(async (tx) => {
        if (isSuccess) {
          return this.markOrderPaidFromPending(
            tx,
            payment.id,
            payment.orderId,
            {
              providerTransactionId: transId
            }
          );
        }

        return this.failOrderAndRestoreStock(tx, payment.orderId, {
          providerTransactionId: transId
        });
      });

      if (!handled) {
        this.logger.log(
          `MoMo IPN: Skip because order is not pending anymore for orderId=${txnRef}`
        );
        return;
      }

      this.logger.log(
        `MoMo IPN: Payment ${isSuccess ? 'SUCCESS' : 'FAILED'} ` +
          `for orderId=${txnRef}, transId=${transId}`
      );

      if (isSuccess) {
        await this.sendPaymentSuccessEmail(payment.orderId);
      }
    } catch (error) {
      this.logger.error(`MoMo IPN: Error processing orderId=${txnRef}`, error);
    }
  }

  /**
   * Handle MoMo Redirect URL callback.
   * Verifies the signature and returns payment result info for the frontend.
   */
  handleMomoReturn(query: Record<string, string>) {
    const { isValid } = this.momoService.verifyRedirectSignature(query);

    if (!isValid) {
      return {
        success: false,
        message: 'Chữ ký không hợp lệ'
      };
    }

    const resultCode = Number(query['resultCode']);
    const isSuccess = resultCode === 0;

    return {
      success: isSuccess,
      message: isSuccess
        ? 'Giao dịch thành công'
        : `Giao dịch không thành công. Mã lỗi: ${resultCode}`,
      data: {
        orderId: query['orderId'],
        amount: Number(query['amount']),
        orderInfo: query['orderInfo'],
        transId: query['transId'],
        resultCode
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
      if (!item.variant.product.isActive) {
        throw new ConflictException(
          `Biến thể ${item.variant.sku} thuộc sản phẩm đã ngừng bán hoặc bị vô hiệu hóa`
        );
      }

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

  async findMyOrders(userId: string, query: QueryOrderDto) {
    await this.expirePendingOnlineOrdersByUser(userId);
    return this.orderRepository.findAllByUser(userId, query);
  }

  async findMyOrderById(id: string, userId: string) {
    await this.expirePendingOnlineOrderById(id, userId);

    const order = await this.orderRepository.findOneByIdAndUserId(id, userId);

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    return order;
  }

  async findAllForAdmin(query: QueryOrderDto) {
    await this.expirePendingOnlineOrders();
    return this.orderRepository.findAllForAdmin(query);
  }

  async findByIdForAdmin(id: string) {
    await this.expirePendingOnlineOrderById(id);

    const order = await this.orderRepository.findOneById(id);
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${id}`);
    }

    return order;
  }

  async updateStatusForAdmin(id: string, dto: UpdateOrderStatusDto) {
    await this.expirePendingOnlineOrderById(id);

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
    const isCanceling =
      currentStatus !== OrderStatus.CANCELED &&
      nextStatus === OrderStatus.CANCELED;

    if (isCanceling && !dto.cancelReason?.trim()) {
      throw new BadRequestException('Vui lòng nhập lý do hủy đơn hàng');
    }

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
      if (isCanceling) {
        const rollbackItems = [...order.items].sort((a, b) =>
          a.variantId.localeCompare(b.variantId)
        );

        for (const item of rollbackItems) {
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

    if (isCanceling) {
      await this.sendOrderCanceledEmail(
        id,
        dto.cancelReason!.trim(),
        ORDER_CANCELED_BY_ADMIN_LABEL
      );
    }

    return updated;
  }

  async retryMyVnpayPayment(orderId: string, userId: string, ipAddr?: string) {
    await this.expirePendingOnlineOrderById(orderId, userId);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${orderId}`);
    }

    if (!order.payment) {
      throw new ConflictException('Đơn hàng chưa có thông tin thanh toán');
    }

    if (order.payment.method !== PaymentMethod.VNPAY) {
      throw new BadRequestException(
        'Chỉ hỗ trợ tạo lại link thanh toán cho VNPAY'
      );
    }

    if (
      order.payment.status !== PaymentStatus.PENDING ||
      order.status !== OrderStatus.PENDING
    ) {
      throw new ConflictException(
        'Đơn hàng không còn ở trạng thái chờ thanh toán'
      );
    }

    const paymentDeadline = this.getOnlinePaymentDeadline(
      order.payment.createdAt
    );
    if (new Date() > paymentDeadline) {
      const canceled = await this.prisma.$transaction(async (tx) => {
        return this.failOrderAndRestoreStock(tx, order.id);
      });

      if (canceled) {
        await this.sendOrderCanceledEmail(
          order.id,
          this.getOnlinePaymentExpiredReason(),
          ORDER_CANCELED_BY_SYSTEM_LABEL
        );
      }

      throw new ConflictException(
        'Đơn hàng đã quá thời gian thanh toán 12 giờ và đã được hủy.'
      );
    }

    const paymentUrl = this.vnpayService.createPaymentUrl({
      ipAddr: ipAddr || '127.0.0.1',
      txnRef: order.payment.code,
      amount: Number(order.payment.amount),
      orderInfo: `Thanh toan don hang ${order.code}`
    });

    return {
      orderId: order.id,
      paymentCode: order.payment.code,
      paymentUrl,
      expiresAt: paymentDeadline.toISOString()
    };
  }

  async retryMyMomoPayment(orderId: string, userId: string) {
    await this.expirePendingOnlineOrderById(orderId, userId);

    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        payment: true
      }
    });

    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng với id ${orderId}`);
    }

    if (!order.payment) {
      throw new ConflictException('Đơn hàng chưa có thông tin thanh toán');
    }

    if (order.payment.method !== PaymentMethod.MOMO) {
      throw new BadRequestException(
        'Chỉ hỗ trợ tạo lại link thanh toán cho MOMO'
      );
    }

    if (
      order.payment.status !== PaymentStatus.PENDING ||
      order.status !== OrderStatus.PENDING
    ) {
      throw new ConflictException(
        'Đơn hàng không còn ở trạng thái chờ thanh toán'
      );
    }

    const paymentDeadline = this.getOnlinePaymentDeadline(
      order.payment.createdAt
    );
    if (new Date() > paymentDeadline) {
      const canceled = await this.prisma.$transaction(async (tx) => {
        return this.failOrderAndRestoreStock(tx, order.id);
      });

      if (canceled) {
        await this.sendOrderCanceledEmail(
          order.id,
          this.getOnlinePaymentExpiredReason(),
          ORDER_CANCELED_BY_SYSTEM_LABEL
        );
      }

      throw new ConflictException(
        'Đơn hàng đã quá thời gian thanh toán 12 giờ và đã được hủy.'
      );
    }

    const paymentUrl = await this.momoService.createPaymentUrl({
      txnRef: order.payment.code,
      amount: Number(order.payment.amount),
      orderInfo: `Thanh toan don hang ${order.code}`
    });

    return {
      orderId: order.id,
      paymentCode: order.payment.code,
      paymentUrl,
      expiresAt: paymentDeadline.toISOString()
    };
  }

  @Cron('*/10 * * * *', {
    name: 'expire-pending-online-orders'
  })
  async expirePendingOnlineOrdersCron() {
    await this.expirePendingOnlineOrders();
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

  private async expirePendingOnlineOrdersByUser(userId: string) {
    const candidates = await this.prisma.order.findMany({
      where: {
        userId,
        status: OrderStatus.PENDING,
        payment: {
          is: {
            status: PaymentStatus.PENDING,
            method: {
              in: [PaymentMethod.VNPAY, PaymentMethod.MOMO]
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    for (const candidate of candidates) {
      await this.expirePendingOnlineOrderById(candidate.id, userId);
    }
  }

  private async expirePendingOnlineOrders() {
    const deadline = new Date(
      Date.now() - ONLINE_PAYMENT_TTL_HOURS * 60 * 60 * 1000
    );

    const expiredOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        payment: {
          is: {
            status: PaymentStatus.PENDING,
            method: {
              in: [PaymentMethod.VNPAY, PaymentMethod.MOMO]
            },
            createdAt: {
              lte: deadline
            }
          }
        }
      },
      select: {
        id: true
      }
    });

    for (const order of expiredOrders) {
      const canceled = await this.prisma.$transaction(async (tx) => {
        return this.failOrderAndRestoreStock(tx, order.id);
      });

      if (canceled) {
        await this.sendOrderCanceledEmail(
          order.id,
          this.getOnlinePaymentExpiredReason(),
          ORDER_CANCELED_BY_SYSTEM_LABEL
        );
      }
    }
  }

  private async expirePendingOnlineOrderById(orderId: string, userId?: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        ...(userId ? { userId } : {})
      },
      include: {
        payment: true
      }
    });

    if (!order || !order.payment) {
      return;
    }

    if (
      order.status !== OrderStatus.PENDING ||
      order.payment.status !== PaymentStatus.PENDING ||
      (order.payment.method !== PaymentMethod.VNPAY &&
        order.payment.method !== PaymentMethod.MOMO)
    ) {
      return;
    }

    const paymentDeadline = this.getOnlinePaymentDeadline(
      order.payment.createdAt
    );
    if (new Date() <= paymentDeadline) {
      return;
    }

    const canceled = await this.prisma.$transaction(async (tx) => {
      return this.failOrderAndRestoreStock(tx, order.id);
    });

    if (canceled) {
      await this.sendOrderCanceledEmail(
        order.id,
        this.getOnlinePaymentExpiredReason(),
        ORDER_CANCELED_BY_SYSTEM_LABEL
      );
    }
  }

  private getOnlinePaymentDeadline(createdAt: Date): Date {
    return new Date(
      createdAt.getTime() + ONLINE_PAYMENT_TTL_HOURS * 60 * 60 * 1000
    );
  }

  private getOnlinePaymentExpiredReason(): string {
    return `Đơn hàng quá thời gian thanh toán ${ONLINE_PAYMENT_TTL_HOURS} giờ và đã bị hủy tự động.`;
  }

  private async markOrderPaidFromPending(
    tx: Prisma.TransactionClient,
    paymentId: string,
    orderId: string,
    options?: {
      providerTransactionId?: string;
    }
  ) {
    const updatedPayment = await tx.payment.updateMany({
      where: {
        id: paymentId,
        status: PaymentStatus.PENDING,
        order: {
          is: {
            status: OrderStatus.PENDING
          }
        }
      },
      data: {
        status: PaymentStatus.SUCCESS,
        providerTransactionId: options?.providerTransactionId
      }
    });

    if (updatedPayment.count === 0) {
      return false;
    }

    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING
      },
      data: {
        status: OrderStatus.PAID
      }
    });

    if (updatedOrder.count === 0) {
      throw new ConflictException(
        `Không thể cập nhật trạng thái đơn hàng ${orderId} sang đã thanh toán`
      );
    }

    return true;
  }

  private async failOrderAndRestoreStock(
    tx: Prisma.TransactionClient,
    orderId: string,
    options?: {
      providerTransactionId?: string;
    }
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true
      }
    });

    if (!order || !order.payment) {
      return false;
    }

    const updatedPayment = await tx.payment.updateMany({
      where: {
        id: order.payment.id,
        status: PaymentStatus.PENDING,
        order: {
          is: {
            status: OrderStatus.PENDING
          }
        }
      },
      data: {
        status: PaymentStatus.FAILED,
        providerTransactionId: options?.providerTransactionId
      }
    });

    if (updatedPayment.count === 0) {
      return false;
    }

    const rollbackItems = [...order.items].sort((a, b) =>
      a.variantId.localeCompare(b.variantId)
    );

    for (const item of rollbackItems) {
      await tx.variant.update({
        where: { id: item.variantId },
        data: { stock: { increment: item.quantity } }
      });
    }

    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.PENDING
      },
      data: {
        status: OrderStatus.CANCELED
      }
    });

    if (updatedOrder.count === 0) {
      throw new ConflictException(
        `Không thể cập nhật trạng thái đơn hàng ${orderId} sang đã hủy`
      );
    }

    return true;
  }

  private async sendOrderCreatedEmail(orderId: string): Promise<void> {
    try {
      const order = await this.getOrderEmailPayload(orderId);

      if (!order) {
        return;
      }

      if (!order.ownerEmail) {
        this.logger.warn(
          `Skip order confirmation email because owner email is missing for orderId=${orderId}`
        );
        return;
      }

      await this.mailService.sendTemplateEmail({
        to: order.ownerEmail,
        subject: `Cảm ơn bạn đã đặt hàng #${order.code}`,
        template: 'order-success',
        context: {
          order,
          orderUrl: `${ORDER_DETAIL_URL_BASE}/${order.id}`,
          paymentTtlHours: ONLINE_PAYMENT_TTL_HOURS
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue order confirmation email for orderId=${orderId}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  private async sendPaymentSuccessEmail(orderId: string): Promise<void> {
    try {
      const order = await this.getOrderEmailPayload(orderId);

      if (!order) {
        return;
      }

      if (!order.ownerEmail) {
        this.logger.warn(
          `Skip payment success email because owner email is missing for orderId=${orderId}`
        );
        return;
      }

      await this.mailService.sendTemplateEmail({
        to: order.ownerEmail,
        subject: `Thanh toán thành công cho đơn hàng #${order.code}`,
        template: 'payment-success',
        context: {
          order: {
            id: order.id,
            code: order.code,
            ownerName: order.ownerName,
            totalAmount: order.totalAmount,
            paymentMethodLabel: order.paymentMethodLabel
          },
          orderUrl: `${ORDER_DETAIL_URL_BASE}/${order.id}`
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue payment success email for orderId=${orderId}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  private async sendOrderCanceledEmail(
    orderId: string,
    cancelReason: string,
    canceledByLabel: string
  ): Promise<void> {
    try {
      const order = await this.getOrderEmailPayload(orderId);

      if (!order) {
        return;
      }

      if (!order.ownerEmail) {
        this.logger.warn(
          `Skip order canceled email because owner email is missing for orderId=${orderId}`
        );
        return;
      }

      await this.mailService.sendTemplateEmail({
        to: order.ownerEmail,
        subject: `Đơn hàng #${order.code} đã bị hủy`,
        template: 'order-canceled',
        context: {
          order: {
            id: order.id,
            code: order.code,
            ownerName: order.ownerName,
            totalAmount: order.totalAmount,
            paymentMethodLabel: order.paymentMethodLabel
          },
          cancelReason,
          canceledByLabel,
          orderUrl: `${ORDER_DETAIL_URL_BASE}/${order.id}`
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to queue order canceled email for orderId=${orderId}`,
        error instanceof Error ? error.stack : String(error)
      );
    }
  }

  private async getOrderEmailPayload(
    orderId: string
  ): Promise<OrderEmailPayload | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payment: true
      }
    });

    if (!order || !order.payment) {
      return null;
    }

    const userSnapshot = this.asJsonObject(order.userSnapshot);
    const shippingAddress = this.asJsonObject(order.shippingAddress);

    const ownerName =
      this.readJsonString(userSnapshot, 'fullname') ||
      this.readJsonString(shippingAddress, 'fullname') ||
      'Khách hàng';
    const ownerEmail = this.readJsonString(userSnapshot, 'email') || '';
    const ownerPhone = this.readJsonString(shippingAddress, 'phone') || '';

    const items: OrderEmailItem[] = order.items.map((item) => {
      const productSnapshot = this.asJsonObject(item.productSnapshot);
      const price = Number(item.price);

      return {
        name:
          this.readJsonString(productSnapshot, 'productName') ||
          this.readJsonString(productSnapshot, 'name') ||
          'Sản phẩm',
        sku: this.readJsonString(productSnapshot, 'sku') || '-',
        image:
          this.readJsonString(productSnapshot, 'image') ||
          ORDER_ITEM_PLACEHOLDER_IMAGE,
        price,
        quantity: item.quantity,
        total: price * item.quantity
      };
    });

    return {
      id: order.id,
      code: order.code,
      ownerName,
      ownerEmail,
      ownerPhone,
      shippingAddress: {
        fullname: this.readJsonString(shippingAddress, 'fullname') || ownerName,
        phone: ownerPhone,
        street: this.readJsonString(shippingAddress, 'street') || '-',
        wardName: this.readJsonString(shippingAddress, 'wardName') || '-',
        districtName:
          this.readJsonString(shippingAddress, 'districtName') || '-',
        provinceName:
          this.readJsonString(shippingAddress, 'provinceName') || '-'
      },
      items,
      totalProductAmount: Number(order.totalProductAmount),
      shippingFee: Number(order.shippingFee),
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.payment.method,
      paymentMethodLabel: this.resolvePaymentMethodLabel(order.payment.method)
    };
  }

  private resolvePaymentMethodLabel(method: PaymentMethod): string {
    switch (method) {
      case PaymentMethod.COD:
        return 'Thanh toán khi nhận hàng (COD)';
      case PaymentMethod.VNPAY:
        return 'VNPay';
      case PaymentMethod.MOMO:
        return 'MoMo';
      default:
        return method;
    }
  }

  private asJsonObject(value: Prisma.JsonValue): Prisma.JsonObject {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return value;
  }

  private readJsonString(
    source: Prisma.JsonObject,
    key: string
  ): string | null {
    const value = source[key];
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
