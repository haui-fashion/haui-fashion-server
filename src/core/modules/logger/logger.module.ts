import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { AppLoggerService } from './logger.service';

const isProduction = process.env.NODE_ENV === 'production';

@Global()
@Module({
  imports: [
    WinstonModule.forRoot({
      level: isProduction ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        isProduction
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize({ all: true }),
              winston.format.printf(
                ({
                  level,
                  message,
                  timestamp,
                  context,
                  fileLocation,
                  fileDir,
                  ...meta
                }) => {
                  const contextStr = context
                    ? `[${typeof context === 'string' ? context : JSON.stringify(context)}]`
                    : '';
                  const sourceStr = fileLocation
                    ? `[${typeof fileLocation === 'string' ? fileLocation : JSON.stringify(fileLocation)}]`
                    : fileDir
                      ? `[${typeof fileDir === 'string' ? fileDir : JSON.stringify(fileDir)}]`
                      : '';
                  const metaStr = Object.keys(meta).length
                    ? ` ${JSON.stringify(meta)}`
                    : '';
                  return `${String(timestamp)} ${String(level)} ${contextStr}${sourceStr} ${String(message)}${metaStr}`;
                }
              )
            )
      ),
      transports: [
        new winston.transports.Console(),
        ...(isProduction
          ? [
              new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error'
              }),
              new winston.transports.File({
                filename: 'logs/combined.log'
              })
            ]
          : [])
      ]
    })
  ],
  providers: [AppLoggerService],
  exports: [AppLoggerService, WinstonModule]
})
export class LoggerModule {}
