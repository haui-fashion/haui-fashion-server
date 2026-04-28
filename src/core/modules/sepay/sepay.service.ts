import { HttpClientService } from '@core/modules/http-client/http-client.service';
import {
  CreateSePayPaymentParams,
  SePayCheckoutForm,
  SePayOrderDetail,
  SePayOrderDetailResponse,
  SePayOrderListResponse,
  SePayVerificationResult
} from '@core/modules/sepay/sepay.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const SIGNED_FIELDS_ORDER = [
  'order_amount',
  'merchant',
  'currency',
  'operation',
  'order_description',
  'order_invoice_number',
  'customer_id',
  'payment_method',
  'success_url',
  'error_url',
  'cancel_url'
] as const;

@Injectable()
export class SePayService {
  private readonly logger = new Logger(SePayService.name);

  private readonly merchantId: string;
  private readonly secretKey: string;
  private readonly ipnSecretKey: string;
  private readonly checkoutUrl: string;
  private readonly apiBaseUrl: string;
  private readonly returnUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClientService: HttpClientService
  ) {
    this.merchantId = this.configService.get<string>('sepay.merchantId', '');
    this.secretKey = this.configService.get<string>('sepay.secretKey', '');
    this.ipnSecretKey = this.configService.get<string>(
      'sepay.ipnSecretKey',
      ''
    );
    this.checkoutUrl = this.configService.get<string>(
      'sepay.checkoutUrl',
      'https://pay-sandbox.sepay.vn/v1/checkout/init'
    );
    this.apiBaseUrl = this.configService.get<string>(
      'sepay.apiBaseUrl',
      'https://pgapi-sandbox.sepay.vn'
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

    const fields: Record<string, string> = {
      order_amount: String(orderAmount),
      merchant: this.merchantId,
      currency: 'VND',
      operation: 'PURCHASE',
      order_description: params.orderInfo,
      order_invoice_number: params.txnRef,
      payment_method: params.paymentMethod || 'BANK_TRANSFER',
      success_url: params.successUrl,
      error_url: params.errorUrl,
      cancel_url: params.cancelUrl
    };

    if (params.customerId) {
      fields['customer_id'] = params.customerId;
    }

    const signature = this.createSignature(fields);

    this.logger.log(
      `Created SePay checkout form for txnRef=${params.txnRef}, amount=${orderAmount}`
    );

    return {
      method: 'POST',
      actionUrl: this.checkoutUrl,
      fields: {
        ...fields,
        signature
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
    if (!this.hasCredentials()) {
      return null;
    }

    try {
      const response =
        await this.httpClientService.get<SePayOrderDetailResponse>(
          `${this.apiBaseUrl}/v1/order/detail/${encodeURIComponent(orderId)}`,
          undefined,
          {
            headers: this.buildBasicAuthHeaders(),
            timeoutMs: 10000
          }
        );

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
    if (!this.hasCredentials()) {
      return null;
    }

    try {
      const response = await this.httpClientService.get<SePayOrderListResponse>(
        `${this.apiBaseUrl}/v1/order`,
        {
          q: orderInvoiceNumber,
          per_page: 10,
          page: 1,
          sort: 'created_at:desc'
        },
        {
          headers: this.buildBasicAuthHeaders(),
          timeoutMs: 10000
        }
      );

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

  private createSignature(fields: Record<string, string>): string {
    const signedString = SIGNED_FIELDS_ORDER.filter((field) => {
      const value = fields[field];
      return value != null && value !== '';
    })
      .map((field) => `${field}=${fields[field]}`)
      .join(',');

    return crypto
      .createHmac('sha256', this.secretKey)
      .update(signedString)
      .digest('base64');
  }

  private hasCredentials(): boolean {
    return Boolean(this.merchantId && this.secretKey);
  }

  private buildBasicAuthHeaders(): Record<string, string> {
    const encodedCredentials = Buffer.from(
      `${this.merchantId}:${this.secretKey}`
    ).toString('base64');

    return {
      Authorization: `Basic ${encodedCredentials}`
    };
  }
}
