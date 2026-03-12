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

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, ip } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const { statusCode } = response;

          this.logger.info('Yêu cầu HTTP', {
            context: 'HTTP',
            method,
            url: originalUrl,
            statusCode,
            duration: `${duration}ms`,
            ip,
            userAgent
          });
        },
        error: (error: HttpException | Error) => {
          const duration = Date.now() - startTime;
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;

          this.logger.error('Lỗi yêu cầu HTTP', {
            context: 'HTTP',
            method,
            url: originalUrl,
            statusCode,
            duration: `${duration}ms`,
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
