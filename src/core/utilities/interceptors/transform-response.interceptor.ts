import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Observable, map } from 'rxjs';

// ============================================================================
// Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  statusCode: number;
  message: string;
  data: T;
}

export interface PaginatedMetaData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedData<T> {
  items: T[];
  meta: PaginatedMetaData;
}

export type ApiPaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// ============================================================================
// Response Builder
// ============================================================================

export class ResponseBuilder<T = unknown> {
  private _statusCode: number = StatusCodes.OK;
  private _message: string = 'Thành công';
  private _data: T | null = null;

  static create<T = unknown>(): ResponseBuilder<T> {
    return new ResponseBuilder<T>();
  }

  statusCode(code: number): this {
    this._statusCode = code;
    return this;
  }

  message(msg: string): this {
    this._message = msg;
    return this;
  }

  data(data: T): this {
    this._data = data;
    return this;
  }

  build(): ApiResponse<T | null> {
    return {
      statusCode: this._statusCode,
      message: this._message,
      data: this._data
    };
  }

  // Convenience static methods
  static success<T>(data: T, message = 'Thành công'): ApiResponse<T> {
    return {
      statusCode: StatusCodes.OK,
      message,
      data
    };
  }

  static created<T>(data: T, message = 'Thành công'): ApiResponse<T> {
    return {
      statusCode: StatusCodes.CREATED,
      message,
      data
    };
  }

  static paginated<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Thành công'
  ): ApiPaginatedResponse<T> {
    return {
      statusCode: StatusCodes.OK,
      message,
      data: {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  }
}

// ============================================================================
// Decorator
// ============================================================================

export const TRANSFORM_RESPONSE_KEY = 'transform_response';
export const SKIP_TRANSFORM_KEY = 'skip_transform';

export interface TransformResponseOptions {
  message?: string;
  statusCode?: number;
}

/**
 * Decorator to customize the transform response message
 *
 * @example
 * @TransformResponse({ message: 'User created successfully', statusCode: 201 })
 * @Post()
 * createUser() { ... }
 */
export const TransformResponse = (options: TransformResponseOptions) =>
  SetMetadata(TRANSFORM_RESPONSE_KEY, options);

/**
 * Decorator to skip the transform response interceptor
 *
 * @example
 * @SkipTransformResponse()
 * @Get('raw')
 * getRawData() { ... }
 */
export const SkipTransformResponse = () =>
  SetMetadata(SKIP_TRANSFORM_KEY, true);

// ============================================================================
// Interceptor
// ============================================================================

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  private static readonly SENSITIVE_KEYS = new Set(['password']);

  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<ApiResponse<T>> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (skipTransform) {
      return next.handle() as unknown as Observable<ApiResponse<T>>;
    }

    const options = this.reflector.getAllAndOverride<TransformResponseOptions>(
      TRANSFORM_RESPONSE_KEY,
      [context.getHandler(), context.getClass()]
    );

    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map<T, ApiResponse<T>>((data) => {
        if (this.isApiResponse(data)) {
          const sanitizedWrappedData = this.sanitizeSensitiveFields(data.data);

          return {
            ...(data as ApiResponse<unknown>),
            data: sanitizedWrappedData
          } as ApiResponse<T>;
        }

        const sanitizedData = this.sanitizeSensitiveFields(data);

        const statusCode =
          options?.statusCode ?? response.statusCode ?? StatusCodes.OK;
        const message = options?.message ?? this.getDefaultMessage(statusCode);

        return {
          statusCode,
          message,
          data: sanitizedData as T
        };
      })
    );
  }

  private sanitizeSensitiveFields(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeSensitiveFields(item));
    }

    if (this.isPlainObject(data)) {
      const objectData = data;
      const sanitizedEntries = Object.entries(objectData)
        .filter(
          ([key]) => !TransformResponseInterceptor.SENSITIVE_KEYS.has(key)
        )
        .map(([key, value]) => [key, this.sanitizeSensitiveFields(value)]);

      return Object.fromEntries(sanitizedEntries);
    }

    return data;
  }

  private isPlainObject(data: unknown): data is Record<string, unknown> {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const prototype = Object.getPrototypeOf(data);
    return prototype === Object.prototype || prototype === null;
  }

  private isApiResponse(data: unknown): data is ApiResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      'statusCode' in data &&
      'message' in data &&
      'data' in data
    );
  }

  private getDefaultMessage(statusCode: number): string {
    const messages: Record<number, string> = {
      [StatusCodes.OK]: 'Thành công',
      [StatusCodes.CREATED]: 'Thành công',
      [StatusCodes.ACCEPTED]: 'Chấp nhận',
      [StatusCodes.NO_CONTENT]: 'Không có dữ liệu'
    };

    return messages[statusCode] ?? 'Thành công';
  }
}
