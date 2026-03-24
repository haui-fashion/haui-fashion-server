import { Injectable, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpClientService } from '@core/modules/http-client/http-client.service';

type GhnResponse<T> = {
  code?: number;
  message?: string;
  data: T;
};

@Injectable()
export class LocationService {
  private readonly baseUrl =
    'https://online-gateway.ghn.vn/shiip/public-api/master-data';
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClientService: HttpClientService
  ) {
    this.token = this.configService.get<string>('GHN_API_TOKEN', 'dummy-token');
    this.timeoutMs = this.configService.get<number>(
      'httpClient.timeoutMs',
      5000
    );
  }

  private async fetchGhn<T>(endpoint: string, data?: unknown): Promise<T> {
    const isPost = !!data;
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const result = isPost
        ? await this.httpClientService.post<GhnResponse<T>>(url, data, {
            headers: {
              'Content-Type': 'application/json',
              token: this.token
            },
            timeoutMs: this.timeoutMs
          })
        : await this.httpClientService.get<GhnResponse<T>>(url, undefined, {
            headers: {
              'Content-Type': 'application/json',
              token: this.token
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
    return this.fetchGhn('/province');
  }

  async getDistricts(provinceId: number) {
    return this.fetchGhn('/district', { province_id: provinceId });
  }

  async getWards(districtId: number) {
    return this.fetchGhn('/ward', { district_id: districtId });
  }
}
