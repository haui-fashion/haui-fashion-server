import { HttpService } from '@nestjs/axios';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosRequestConfig, Method } from 'axios';
import * as qs from 'qs';
import {
  HttpClientRequestOptions,
  HttpClientServiceInterface
} from './interface/http-client.service.interface';

@Injectable()
export class HttpClientService implements HttpClientServiceInterface {
  private readonly defaultTimeoutMs: number;

  constructor(
    private httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.defaultTimeoutMs = this.configService.get<number>(
      'httpClient.timeoutMs',
      5000
    );
  }

  async get<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: HttpClientRequestOptions
  ): Promise<T> {
    return this.request<T>('GET', url, {
      params,
      ...options
    });
  }

  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientRequestOptions
  ): Promise<T> {
    return this.request<T>('POST', url, {
      data: body,
      ...options
    });
  }

  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: HttpClientRequestOptions
  ): Promise<T> {
    return this.request<T>('PUT', url, {
      data: body,
      ...options
    });
  }

  async delete<T = unknown>(
    url: string,
    params?: Record<string, unknown>,
    options?: HttpClientRequestOptions
  ): Promise<T> {
    return this.request<T>('DELETE', url, {
      params,
      ...options
    });
  }

  private async request<T = unknown>(
    method: Method,
    url: string,
    options?: HttpClientRequestOptions & {
      data?: unknown;
    }
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url,
      data: options?.data,
      params: options?.params,
      timeout: options?.timeoutMs ?? this.defaultTimeoutMs,
      headers: options?.headers,
      paramsSerializer: (params) =>
        qs.stringify(params, { arrayFormat: 'repeat' })
    };

    try {
      const response = await this.httpService.axiosRef.request<T>(config);
      return response.data;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error;
    }

    const axiosError = error as AxiosError<{ message?: string | string[] }>;

    if (axiosError.response) {
      const payloadMessage = axiosError.response.data?.message;
      const message = Array.isArray(payloadMessage)
        ? payloadMessage.join(', ')
        : payloadMessage || axiosError.message || 'HTTP request failed';

      return new HttpException(message, axiosError.response.status);
    }

    if (axiosError.request) {
      return new ServiceUnavailableException(
        axiosError.message || 'HTTP upstream service is unavailable'
      );
    }

    return new InternalServerErrorException(
      axiosError.message || 'Unexpected HTTP client error'
    );
  }
}
