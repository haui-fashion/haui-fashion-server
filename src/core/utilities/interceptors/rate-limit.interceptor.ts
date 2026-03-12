import { AppCacheService } from '@core/modules/app-cache';
import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  SetMetadata
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Observable } from 'rxjs';

// ============================================================================
// Configuration & Types
// ============================================================================

export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed within the TTL window
   * @default 100
   */
  limit?: number;

  /**
   * Time-to-live in milliseconds for the rate limit window
   * @default 60000 (1 minute)
   */
  ttl?: number;

  /**
   * Custom key generator function to identify the client
   * By default, uses IP address
   */
  keyGenerator?: (context: ExecutionContext) => string;

  /**
   * Custom error message when rate limit is exceeded
   */
  message?: string;

  /**
   * Skip rate limiting for certain conditions
   */
  skipIf?: (context: ExecutionContext) => boolean;
}

interface RateLimitRecord {
  count: number;
  firstRequest: number;
}

// ============================================================================
// Decorator
// ============================================================================

export const RATE_LIMIT_KEY = 'rate_limit';

/**
 * Decorator to apply rate limiting to a specific route or controller
 *
 * @example
 * // Apply to a specific route with custom options
 * @RateLimit({ limit: 5, ttl: 10000 })
 * @Get('sensitive')
 * getSensitiveData() { ... }
 *
 * @example
 * // Apply to entire controller
 * @RateLimit({ limit: 100, ttl: 60000 })
 * @Controller('api')
 * export class ApiController { ... }
 */
export const RateLimit = (options: RateLimitOptions = {}) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Decorator to skip rate limiting for a specific route
 */
export const SkipRateLimit = () =>
  SetMetadata(RATE_LIMIT_KEY, { skipIf: () => true });

// ============================================================================
// Interceptor
// ============================================================================

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly defaultLimit = 100;
  private readonly defaultTtl = 60000;

  constructor(private readonly reflector: Reflector) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<unknown>> {
    const options = this.getRateLimitOptions(context);

    if (!options || options.skipIf?.(context)) {
      return next.handle();
    }

    const limit = options.limit ?? this.defaultLimit;
    const ttl = options.ttl ?? this.defaultTtl;
    const key = this.generateKey(context, options);

    await this.checkRateLimit(key, limit, ttl, options.message);

    return next.handle();
  }

  private getRateLimitOptions(
    context: ExecutionContext
  ): RateLimitOptions | undefined {
    return this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass()
    ]);
  }

  private generateKey(
    context: ExecutionContext,
    options: RateLimitOptions
  ): string {
    if (options.keyGenerator) {
      return `rate_limit:${options.keyGenerator(context)}`;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const path = request.path;
    const method = request.method;

    return `rate_limit:${method}:${path}:${ip}`;
  }

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.ip ?? request.socket.remoteAddress ?? 'unknown';
  }

  private async checkRateLimit(
    key: string,
    limit: number,
    ttl: number,
    customMessage?: string
  ): Promise<void> {
    const cache = AppCacheService.instance;
    const now = Date.now();

    const record = await cache.get<RateLimitRecord>(key);

    if (!record) {
      await cache.set<RateLimitRecord>(
        key,
        { count: 1, firstRequest: now },
        ttl
      );
      return;
    }

    const elapsed = now - record.firstRequest;

    if (elapsed >= ttl) {
      await cache.set<RateLimitRecord>(
        key,
        { count: 1, firstRequest: now },
        ttl
      );
      return;
    }

    if (record.count >= limit) {
      const retryAfter = Math.ceil((ttl - elapsed) / 1000);
      throw new HttpException(
        {
          statusCode: StatusCodes.TOO_MANY_REQUESTS,
          message:
            customMessage ??
            'Quá nhiều yêu cầu. Vui lòng thử lại sau vài giây.',
          error: 'Quá nhiều yêu cầu',
          retryAfter
        },
        StatusCodes.TOO_MANY_REQUESTS
      );
    }

    await cache.set<RateLimitRecord>(
      key,
      { count: record.count + 1, firstRequest: record.firstRequest },
      ttl - elapsed
    );
  }
}
