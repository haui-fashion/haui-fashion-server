import { Inject, Injectable, LoggerService, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLoggerService implements LoggerService {
  private context?: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger
  ) {}

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context: context || this.context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }

  // Extended methods for structured logging
  logWithMeta(message: string, meta: Record<string, any>) {
    this.logger.info(message, { context: this.context, ...meta });
  }

  errorWithMeta(message: string, error: Error, meta?: Record<string, any>) {
    this.logger.error(message, {
      context: this.context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...meta
    });
  }
}
