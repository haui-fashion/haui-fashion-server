import { AppCacheModule } from '@core/modules/app-cache';
import { AppJwtModule } from '@core/modules/app-jwt/app-jwt.module';
import { JwtAuthGuard } from '@core/modules/app-jwt/guards/jwt-auth.guard';
import { RolesGuard } from '@core/modules/app-jwt/guards/roles.guard';
import { AppBullModule } from '@core/modules/bull';
import { AppBullBoardModule } from '@core/modules/bull-board';
import { CloudinaryModule } from '@core/modules/cloudinary/cloudinary.module';
import { AppConfigModule } from '@core/modules/config';
import { EmbeddingModule } from '@core/modules/embedding';
import { GeminiModule } from '@core/modules/gemini';
import { HealthModule } from '@core/modules/health';
import { HttpClientModule } from '@core/modules/http-client/http-client.module';
import { LoggerModule } from '@core/modules/logger';
import { AppMailModule } from '@core/modules/mail/mail.module';
import { MetricsModule } from '@core/modules/metrics/metrics.module';
import { OllamaModule } from '@core/modules/ollama';
import { PrismaModule } from '@core/modules/prisma';
import { SePayModule } from '@core/modules/sepay';
import { TiptapModule } from '@core/modules/tiptap';
import { VNPayModule } from '@core/modules/vnpay';
import { AppExceptionFilter } from '@core/utilities/filters';
import {
  LoggingInterceptor,
  RateLimitInterceptor,
  TransformResponseInterceptor
} from '@core/utilities/interceptors';
import { ValidationPipe } from '@core/utilities/pipes';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule,
    MetricsModule,
    AppCacheModule,
    AppBullModule,
    AppBullBoardModule,
    CloudinaryModule,
    HealthModule,
    HttpClientModule,
    EventEmitterModule.forRoot(),
    PrismaModule,
    AppJwtModule,
    AppMailModule,
    EmbeddingModule,
    GeminiModule,
    OllamaModule,
    ScheduleModule.forRoot(),
    TiptapModule,
    VNPayModule,
    SePayModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100
      }
    ])
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformResponseInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true
      })
    }
  ],
  exports: [
    AppConfigModule,
    AppBullModule,
    LoggerModule,
    VNPayModule,
    SePayModule
  ]
})
export class CoreModule {}
