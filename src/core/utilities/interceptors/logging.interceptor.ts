import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
  NestInterceptor
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Observable, tap } from 'rxjs';
import { Logger } from 'winston';
import { MetricsService } from '@core/modules/metrics/metrics.service';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly metricsService: MetricsService
  ) {}

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const firstIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return this.normalizeIp(firstIp.trim());
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      const ip = Array.isArray(realIp) ? realIp[0] : realIp;
      return this.normalizeIp(ip.trim());
    }

    return this.normalizeIp(request.ip || request.socket.remoteAddress || '');
  }

  private normalizeIp(ip: string): string {
    return ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip;
  }

  private resolveRoute(request: Request): string {
    const routePath = request.route?.path;
    if (typeof routePath === 'string' && routePath.length > 0) {
      return routePath;
    }

    return (
      (request.originalUrl || request.url || '').split('?')[0] || 'unknown'
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl } = request;
    const route = this.resolveRoute(request);
    const requestId =
      request.get('x-request-id') ||
      request.get('x-correlation-id') ||
      randomUUID();
    const ip = this.getClientIp(request);
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startTime;
          const { statusCode } = response;

          this.metricsService.observeHttpRequest({
            method,
            route,
            statusCode,
            durationMs
          });

          this.logger.info('Yêu cầu HTTP', {
            context: 'HTTP',
            method,
            url: originalUrl,
            route,
            requestId,
            statusCode,
            duration: `${durationMs}ms`,
            duration_ms: durationMs,
            ip,
            userAgent
          });
        },
        error: (error: HttpException | Error) => {
          const durationMs = Date.now() - startTime;
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;

          this.metricsService.observeHttpRequest({
            method,
            route,
            statusCode,
            durationMs
          });

          this.logger.error('Lỗi yêu cầu HTTP', {
            context: 'HTTP',
            method,
            url: originalUrl,
            route,
            requestId,
            statusCode,
            duration: `${durationMs}ms`,
            duration_ms: durationMs,
            ip,
            userAgent,
            error: {
              name: error.name,
              message: error.message
            }
          });
        }
      })
    );
  }
}
