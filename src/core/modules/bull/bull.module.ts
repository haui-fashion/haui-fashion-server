import { AppConfigModule } from '@core/modules/config';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('database.redis.host'),
          port: configService.get<number>('database.redis.port'),
          password: configService.get<string>('database.redis.password'),
          db: configService.get<number>('database.redis.db')
        },
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      }),
      inject: [ConfigService]
    })
  ],
  exports: [BullModule]
})
export class AppBullModule {}
