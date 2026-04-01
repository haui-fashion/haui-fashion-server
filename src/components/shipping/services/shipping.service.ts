import { GetShippingFeeDto } from '@components/shipping/dtos/get-shipping-fee.dto';
import { GetShippingServiceDto } from '@components/shipping/dtos/get-shipping-service.dto';
import { HttpClientService } from '@core/modules/http-client/http-client.service';
import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GhnResponse<T> = {
  code?: number;
  message?: string;
  data: T;
};

type ShippingServiceItem = {
  service_id?: unknown;
  service_type_id?: unknown;
  short_name?: unknown;
};

@Injectable()
export class ShippingService {
  private static readonly DEFAULT_SHIPPING_FEE = {
    total: 30000
  };

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly shopId: number;

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
      this.configService.get<number>('shipping.ghn.shopId') || 10000;
  }

  private async fetchGhn<T>(endpoint: string, data?: unknown): Promise<T> {
    const isPost = !!data;
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const result = isPost
        ? await this.httpClientService.post<GhnResponse<T>>(url, data, {
            headers: {
              'Content-Type': 'application/json',
              Token: this.token,
              ShopId: this.shopId
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

  async getShippingServices(dto: GetShippingServiceDto) {
    return this.fetchGhn('public-api/v2/shipping-order/available-services', {
      shop_id: this.shopId,
      from_district: 1482,
      to_district: +dto.toDistrictId
    });
  }

  async getShippingFee(dto: GetShippingFeeDto) {
    const shippingServices = await this.getShippingServices({
      toDistrictId: dto.toDistrictId
    });

    const services = Array.isArray(shippingServices)
      ? shippingServices
      : Array.isArray((shippingServices as { data?: unknown[] })?.data)
        ? (shippingServices as { data: unknown[] }).data
        : [];

    const matchedService = this.selectPreferredShippingService(
      services as ShippingServiceItem[]
    );

    if (!matchedService) {
      return ShippingService.DEFAULT_SHIPPING_FEE;
    }

    return this.fetchGhn('public-api/v2/shipping-order/fee', {
      to_ward_code: dto.toWardCode,
      to_district_id: +dto.toDistrictId,
      insurance_value: dto.insuranceValue,
      cod_value: dto.codValue,
      service_type_id: 2,
      service_id: matchedService.service_id,
      weight: 2000
    });
  }

  private selectPreferredShippingService(
    services: ShippingServiceItem[]
  ): { service_id: number } | null {
    const byType = services.find(
      (service) => Number(service.service_type_id) === 2
    );
    if (byType && Number.isFinite(Number(byType.service_id))) {
      return { service_id: Number(byType.service_id) };
    }

    const byShortName = services.find(
      (service) =>
        (typeof service.short_name === 'string'
          ? service.short_name
          : ''
        ).trim() === 'Hàng nhẹ'
    );
    if (byShortName && Number.isFinite(Number(byShortName.service_id))) {
      return { service_id: Number(byShortName.service_id) };
    }

    return null;
  }
}
