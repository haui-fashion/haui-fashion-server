import {
  CreateSePayPaymentParams,
  SePayCheckoutForm,
  SePayOrderDetail,
  SePayVerificationResult
} from '@core/modules/sepay/sepay.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SePayPgClient } from 'sepay-pg-node';

@Injectable()
export class SePayService {
  private readonly logger = new Logger(SePayService.name);

  private readonly client: SePayPgClient | null;
  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly ipnSecretKey: string;
  private readonly env: 'sandbox' | 'production';
  private readonly checkoutUrl: string;
  private readonly returnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.merchantId = this.configService.get<string>('sepay.merchantId', '');
    this.secretKey = this.configService.get<string>('sepay.secretKey', '');
    this.ipnSecretKey = this.configService.get<string>(
      'sepay.ipnSecretKey',
      ''
    );
    this.env = this.configService.get<'sandbox' | 'production'>(
      'sepay.env',
      'sandbox'
    );
    this.client = this.hasCredentials()
      ? new SePayPgClient({
          env: this.env,
          merchant_id: this.merchantId,
          secret_key: this.secretKey
        })
      : null;
    this.checkoutUrl = this.configService.get<string>(
      'sepay.checkoutUrl',
      'https://pay-sandbox.sepay.vn/v1/checkout/init'
    );
    this.returnUrl = this.configService.get<string>(
      'sepay.returnUrl',
      'http://localhost:3000/orders'
    );

    if (!this.merchantId || !this.secretKey) {
      this.logger.warn(
        'SePay credentials (SEPAY_MERCHANT_ID / SEPAY_SECRET_KEY) are not configured. SePay payments will not work.'
      );
    }
  }

  createCheckoutForm(params: CreateSePayPaymentParams): SePayCheckoutForm {
    const orderAmount = Math.max(0, Math.round(params.amount));
    const paymentMethod = params.paymentMethod || 'BANK_TRANSFER';
    const checkoutFields = this.client
      ? this.client.checkout.initOneTimePaymentFields({
          operation: 'PURCHASE',
          payment_method: paymentMethod as never,
          order_invoice_number: params.txnRef,
          order_amount: orderAmount,
          currency: 'VND',
          order_description: params.orderInfo,
          customer_id: params.customerId,
          success_url: params.successUrl,
          error_url: params.errorUrl,
          cancel_url: params.cancelUrl
        })
      : {
          order_amount: String(orderAmount),
          merchant: this.merchantId,
          currency: 'VND',
          operation: 'PURCHASE',
          order_description: params.orderInfo,
          order_invoice_number: params.txnRef,
          payment_method: paymentMethod,
          success_url: params.successUrl,
          error_url: params.errorUrl,
          cancel_url: params.cancelUrl
        };

    this.logger.log(
      `Created SePay checkout form for txnRef=${params.txnRef}, amount=${orderAmount}`
    );

    return {
      method: 'POST',
      actionUrl: this.client
        ? this.client.checkout.initCheckoutUrl()
        : this.checkoutUrl,
      fields: {
        ...Object.entries(checkoutFields).reduce<Record<string, string>>(
          (result, [field, value]) => {
            if (value !== undefined && value !== null) {
              result[field] = String(value);
            }

            return result;
          },
          {}
        )
      }
    };
  }

  verifyIpnSecretKey(secretKeyHeader?: string): SePayVerificationResult {
    if (!this.ipnSecretKey) {
      return { isValid: true };
    }

    if (secretKeyHeader === this.ipnSecretKey) {
      return { isValid: true };
    }

    this.logger.warn('SePay IPN verification failed: invalid X-Secret-Key');

    return {
      isValid: false,
      reason: 'invalid_secret_key'
    };
  }

  async getOrderDetail(orderId: string): Promise<SePayOrderDetail | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.order.retrieve(orderId);

      return response.data || null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch SePay order detail for orderId=${orderId}`,
        error as Error
      );
      return null;
    }
  }

  async findOrderByInvoiceNumber(
    orderInvoiceNumber: string
  ): Promise<SePayOrderDetail | null> {
    if (!this.client) {
      return null;
    }

    try {
      const response = await this.client.order.all({
        per_page: 10,
        q: orderInvoiceNumber,
        sort: {
          created_at: 'desc'
        }
      });

      const candidates = response.data || [];
      const exactMatch = candidates.find(
        (order) => order.order_invoice_number === orderInvoiceNumber
      );

      return exactMatch || candidates[0] || null;
    } catch (error) {
      this.logger.warn(
        `Failed to query SePay order by invoice=${orderInvoiceNumber}`,
        error as Error
      );
      return null;
    }
  }

  buildReturnUrl(result: 'success' | 'error' | 'cancel', paymentCode: string) {
    const separator = this.returnUrl.includes('?') ? '&' : '?';

    return `${this.returnUrl}${separator}provider=SEPAY&result=${result}&paymentCode=${encodeURIComponent(paymentCode)}`;
  }

  isPaidOrderStatus(orderStatus?: string): boolean {
    return orderStatus === 'CAPTURED';
  }

  isCanceledOrderStatus(orderStatus?: string): boolean {
    return orderStatus === 'CANCELLED';
  }

  private hasCredentials(): boolean {
    return Boolean(this.merchantId && this.secretKey);
  }
}
