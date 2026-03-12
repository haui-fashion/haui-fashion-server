import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from '@nestjs/common';
import { Request, Response } from 'express';

// ============================================================================
// Error Response Type
// ============================================================================

export interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  method: string;
  details?: unknown;
}

// ============================================================================
// Exception Filter
// ============================================================================

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);

    this.logError(exception, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;
    const method = request.method;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const { message, error, details } =
        this.extractHttpExceptionDetails(exceptionResponse);

      return {
        statusCode: status,
        message,
        error,
        timestamp,
        path,
        method,
        ...(details !== undefined ? { details } : {})
      };
    }

    // Handle non-HTTP exceptions
    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Lỗi máy chủ nội bộ',
        error: 'Internal Server Error',
        timestamp,
        path,
        method,
        ...(process.env.NODE_ENV !== 'production'
          ? {
              details: {
                name: exception.name,
                message: exception.message,
                stack: exception.stack
              }
            }
          : {})
      };
    }

    // Handle unknown exceptions
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Đã xảy ra lỗi không mong muốn',
      error: 'Internal Server Error',
      timestamp,
      path,
      method
    };
  }

  private extractHttpExceptionDetails(exceptionResponse: unknown): {
    message: string;
    error: string;
    details?: unknown;
  } {
    if (typeof exceptionResponse === 'string') {
      return {
        message: exceptionResponse,
        error: exceptionResponse
      };
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const response = exceptionResponse as Record<string, unknown>;

      // Handle class-validator errors (array of messages)
      const rawMessage: unknown = response['message'];
      let message: string;
      let details: string[] | undefined;

      if (Array.isArray(rawMessage)) {
        message = (rawMessage[0] as string) || 'Xác thực không thành công';
        details = rawMessage as string[];
      } else {
        message =
          typeof rawMessage === 'string'
            ? rawMessage
            : 'Đã xảy ra lỗi không mong muốn';
      }

      return {
        message,
        error: (response['error'] as string) || 'Error',
        ...(details !== undefined ? { details } : {})
      };
    }

    return {
      message: 'An error occurred',
      error: 'Error'
    };
  }

  private logError(exception: unknown, errorResponse: ErrorResponse): void {
    const { statusCode, path, method, message } = errorResponse;

    if (statusCode >= 500) {
      this.logger.error(
        `[${method}] ${path} - ${statusCode}: ${message}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else if (statusCode >= 400) {
      this.logger.warn(`[${method}] ${path} - ${statusCode}: ${message}`);
    }
  }
}
