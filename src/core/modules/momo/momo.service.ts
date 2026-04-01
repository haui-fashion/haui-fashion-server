import { HttpClientService } from '@core/modules/http-client/http-client.service';
import {
  CreateMoMoPaymentParams,
  MoMoCreatePaymentResponse,
  MoMoIpnBody,
  MoMoVerificationResult
} from '@core/modules/momo/momo.interface';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class MoMoService {
  private readonly logger = new Logger(MoMoService.name);

  private readonly partnerCode: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly apiUrl: string;
  private readonly redirectUrl: string;
  private readonly ipnUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClientService: HttpClientService
  ) {
    this.partnerCode = this.configService.get<string>('momo.partnerCode', '');
    this.accessKey = this.configService.get<string>('momo.accessKey', '');
    this.secretKey = this.configService.get<string>('momo.secretKey', '');
    this.apiUrl = this.configService.get<string>(
      'momo.apiUrl',
      'https://test-payment.momo.vn'
    );
    this.redirectUrl = this.configService.get<string>(
      'momo.redirectUrl',
      'http://localhost:3000/orders'
    );
    this.ipnUrl = this.configService.get<string>(
      'momo.ipnUrl',
      'http://localhost:3000/api/v1/orders/momo-ipn'
    );
  }

  async createPaymentUrl(params: CreateMoMoPaymentParams): Promise<string> {
    const requestId = `${params.txnRef}_${Date.now()}`;
    const extraData = '';

    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${params.amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${this.ipnUrl}` +
      `&orderId=${params.txnRef}` +
      `&orderInfo=${params.orderInfo}` +
      `&partnerCode=${this.partnerCode}` +
      `&redirectUrl=${this.redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=captureWallet`;

    const signature = this.createHmacSignature(rawSignature);

    const requestBody = {
      partnerCode: this.partnerCode,
      accessKey: this.accessKey,
      requestId,
      amount: params.amount,
      orderId: params.txnRef,
      orderInfo: params.orderInfo,
      redirectUrl: this.redirectUrl,
      ipnUrl: this.ipnUrl,
      extraData,
      requestType: 'captureWallet',
      signature,
      lang: 'vi'
    };

    const endpoint = `${this.apiUrl}/v2/gateway/api/create`;

    this.logger.log(
      `Creating MoMo payment for orderId=${params.txnRef}, amount=${params.amount}`
    );

    const response =
      await this.httpClientService.post<MoMoCreatePaymentResponse>(
        endpoint,
        requestBody,
        { timeoutMs: 30000 }
      );

    if (response.resultCode !== 0) {
      this.logger.error(
        `MoMo create payment failed: resultCode=${response.resultCode}, message=${response.message}`
      );
      throw new Error(
        `MoMo create payment failed: ${response.message} (code: ${response.resultCode})`
      );
    }

    this.logger.log(
      `MoMo payment URL created for orderId=${params.txnRef}: ${response.payUrl}`
    );

    return response.payUrl;
  }

  verifyIpnSignature(body: MoMoIpnBody): MoMoVerificationResult {
    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${body.amount}` +
      `&extraData=${body.extraData}` +
      `&message=${body.message}` +
      `&orderId=${body.orderId}` +
      `&orderInfo=${body.orderInfo}` +
      `&orderType=${body.orderType}` +
      `&partnerCode=${body.partnerCode}` +
      `&payType=${body.payType}` +
      `&requestId=${body.requestId}` +
      `&responseTime=${body.responseTime}` +
      `&resultCode=${body.resultCode}` +
      `&transId=${body.transId}`;

    const expectedSignature = this.createHmacSignature(rawSignature);
    const isValid = body.signature === expectedSignature;

    if (!isValid) {
      this.logger.warn(
        `MoMo IPN signature verification failed for orderId=${body.orderId}`
      );
    }

    return { isValid };
  }

  verifyRedirectSignature(
    query: Record<string, string>
  ): MoMoVerificationResult {
    const rawSignature =
      `accessKey=${this.accessKey}` +
      `&amount=${query['amount']}` +
      `&extraData=${query['extraData']}` +
      `&message=${query['message']}` +
      `&orderId=${query['orderId']}` +
      `&orderInfo=${query['orderInfo']}` +
      `&orderType=${query['orderType']}` +
      `&partnerCode=${query['partnerCode']}` +
      `&payType=${query['payType']}` +
      `&requestId=${query['requestId']}` +
      `&responseTime=${query['responseTime']}` +
      `&resultCode=${query['resultCode']}` +
      `&transId=${query['transId']}`;

    const expectedSignature = this.createHmacSignature(rawSignature);
    const isValid = query['signature'] === expectedSignature;

    if (!isValid) {
      this.logger.warn(
        `MoMo redirect signature verification failed for orderId=${query['orderId']}`
      );
    }

    return { isValid };
  }

  private createHmacSignature(rawSignature: string): string {
    return crypto
      .createHmac('sha256', this.secretKey)
      .update(rawSignature)
      .digest('hex');
  }
}
