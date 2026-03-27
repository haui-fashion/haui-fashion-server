import { GetShippingFeeDto } from '@components/shipping/dtos/get-shipping-fee.dto';
import { HttpClientService } from '@core/modules/http-client/http-client.service';
import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GhnResponse<T> = {
  code?: number;
  message?: string;
  data: T;
};

@Injectable()
export class ShippingService {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly shopId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClientService: HttpClientService
  ) {
    this.baseUrl =
      this.configService.get<string>('shipping.ghn.baseUrl') ||
      'https://dev-online-gateway.ghn.vn/shiip/';
    this.token =
      this.configService.get<string>('shipping.ghn.apiToken') || 'dummy';
    this.timeoutMs = this.configService.get<number>(
      'shipping.ghn.timeoutMs',
      5000
    );
    this.shopId =
      this.configService.get<string>('shipping.ghn.shopId') || 'dummy';
  }

  private async fetchGhn<T>(endpoint: string, data?: unknown): Promise<T> {
    const isPost = !!data;
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const result = isPost
        ? await this.httpClientService.post<GhnResponse<T>>(url, data, {
            headers: {
              'Content-Type': 'application/json',
              Token: this.token
            },
            timeoutMs: this.timeoutMs
          })
        : await this.httpClientService.get<GhnResponse<T>>(url, undefined, {
            headers: {
              'Content-Type': 'application/json',
              Token: this.token,
              ShopId: this.shopId
            },
            timeoutMs: this.timeoutMs
          });

      if (result.code && result.code !== 200) {
        throw new HttpException(result.message || 'GHN API Error', 400);
      }

      return result.data;
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;

      const message =
        error instanceof Error ? error.message : 'Lỗi khi gọi API GHN';

      throw new HttpException(message, 500);
    }
  }

  async getProvinces() {
    return this.fetchGhn('public-api/master-data/province');
  }

  async getDistricts(provinceId: number) {
    return this.fetchGhn('public-api/master-data/district', {
      province_id: provinceId
    });
  }

  async getWards(districtId: number) {
    return this.fetchGhn('public-api/master-data/ward', {
      district_id: districtId
    });
  }

  async getShippingFee(dto: GetShippingFeeDto) {
    return this.fetchGhn('v2/shipping-order/fee', {
      to_ward_code: dto.toWardCode,
      to_district_id: dto.toDistrictId,
      insurance_value: dto.insuranceValue
    });
  }
}
