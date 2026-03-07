import { AppCacheService } from '@core/modules/app-cache/services/app-cache.service';
import { AppConfigModule } from '@core/modules/config';
import KeyvRedis from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Keyv } from 'keyv';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>('database.redis.host');
        const port = configService.get<number>('database.redis.port');
        const password = configService.get<string>('database.redis.password');
        const db = configService.get<number>('database.redis.db');

        const redisUrl = password
          ? `redis://:${password}@${host}:${port}/${db}`
          : `redis://${host}:${port}/${db}`;

        return {
          stores: [new Keyv({ store: new KeyvRedis(redisUrl) })]
        };
      },
      inject: [ConfigService]
    })
  ],
  providers: [AppCacheService],
  exports: [CacheModule, AppCacheService]
})
export class AppCacheModule {}
