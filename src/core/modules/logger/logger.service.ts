import { Inject, Injectable, LoggerService, Scope } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { relative } from 'path';
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

  private resolveCallerLocation(): {
    fileLocation: string;
  } {
    const stackLines = new Error().stack?.split('\n').slice(2) ?? [];

    for (const line of stackLines) {
      const matchedFrame =
        line.match(/\((.*):(\d+):(\d+)\)/) || line.match(/at (.*):(\d+):(\d+)/);

      if (!matchedFrame) {
        continue;
      }

      const [, rawPath, rawLine] = matchedFrame;

      const normalizedPath = rawPath.trim();
      if (
        normalizedPath.includes('node_modules') ||
        normalizedPath.endsWith('logger.service.ts') ||
        normalizedPath.endsWith('logger.service.js')
      ) {
        continue;
      }

      const relativePath = relative(process.cwd(), normalizedPath).replace(
        /\\/g,
        '/'
      );
      const displayPath =
        relativePath && !relativePath.startsWith('..')
          ? relativePath
          : normalizedPath;
      const fileLine = Number(rawLine);

      return {
        fileLocation: `${displayPath}:${fileLine}`
      };
    }

    return {
      fileLocation: 'unknown'
    };
  }

  private buildMeta(context?: string, meta?: Record<string, unknown>) {
    return {
      context: context || this.context,
      ...this.resolveCallerLocation(),
      ...(meta || {})
    };
  }

  log(message: string, context?: string) {
    this.logger.info(message, this.buildMeta(context));
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, this.buildMeta(context, { trace }));
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, this.buildMeta(context));
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, this.buildMeta(context));
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, this.buildMeta(context));
  }

  // Extended methods for structured logging
  logWithMeta(message: string, meta: Record<string, any>) {
    this.logger.info(message, this.buildMeta(undefined, meta));
  }

  errorWithMeta(message: string, error: Error, meta?: Record<string, any>) {
    this.logger.error(message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...this.buildMeta(undefined, meta)
    });
  }
}
