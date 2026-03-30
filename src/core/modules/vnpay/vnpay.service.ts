import {
  CreatePaymentUrlParams,
  VNPayVerificationResult
} from '@core/modules/vnpay/vnpay.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as qs from 'qs';

@Injectable()
export class VNPayService {
  private readonly logger = new Logger(VNPayService.name);

  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly paymentUrl: string;
  private readonly returnUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.tmnCode = this.configService.get<string>('vnpay.tmnCode', '');
    this.hashSecret = this.configService.get<string>('vnpay.hashSecret', '');
    this.paymentUrl = this.configService.get<string>(
      'vnpay.paymentUrl',
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    );
    this.returnUrl = this.configService.get<string>(
      'vnpay.returnUrl',
      'http://localhost:3000/orders'
    );

    if (!this.tmnCode || !this.hashSecret) {
      this.logger.warn(
        'VNPay credentials (VNPAY_TMN_CODE / VNPAY_HASH_SECRET) are not configured. VNPay payments will not work.'
      );
    }
  }

  createPaymentUrl(params: CreatePaymentUrlParams): string {
    const date = new Date();
    const createDate = this.formatDate(date);

    const expireDate = new Date(date.getTime() + 15 * 60 * 1000);
    const expireDateStr = this.formatDate(expireDate);

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: params.locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.txnRef,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(params.amount * 100),
      vnp_ReturnUrl: this.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDateStr
    };

    if (params.bankCode) {
      vnpParams['vnp_BankCode'] = params.bankCode;
    }

    const sortedParams = this.sortObject(vnpParams);

    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    sortedParams['vnp_SecureHash'] = signed;

    const paymentUrl =
      this.paymentUrl + '?' + qs.stringify(sortedParams, { encode: false });

    this.logger.log(
      `Created VNPay payment URL for txnRef=${params.txnRef}, amount=${params.amount}`
    );

    return paymentUrl;
  }

  verifySecureHash(query: Record<string, string>): VNPayVerificationResult {
    const vnpParams = { ...query };

    const secureHash = vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = secureHash === signed;

    if (!isValid) {
      this.logger.warn(
        `VNPay signature verification failed for txnRef=${vnpParams['vnp_TxnRef']}`
      );
    }

    return { isValid, vnpParams: sortedParams as Record<string, string> };
  }

  private sortObject(
    obj: Record<string, string | number>
  ): Record<string, string | number> {
    const sorted: Record<string, string | number> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
      sorted[key] = obj[key];
    }

    return sorted;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');

    const vnDate = new Date(
      date.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
    );

    return (
      vnDate.getFullYear().toString() +
      pad(vnDate.getMonth() + 1) +
      pad(vnDate.getDate()) +
      pad(vnDate.getHours()) +
      pad(vnDate.getMinutes()) +
      pad(vnDate.getSeconds())
    );
  }
}
