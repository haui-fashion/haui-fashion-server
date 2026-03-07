import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class AppCacheService implements OnModuleInit {
  private static _instance: AppCacheService;

  public static get instance(): AppCacheService {
    return AppCacheService._instance;
  }

  private static set instance(value: AppCacheService) {
    AppCacheService._instance = value;
  }

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  onModuleInit() {
    if (!AppCacheService.instance) {
      AppCacheService.instance = this;
    }
  }

  get<T>(key: string) {
    return this.cacheManager.get<T>(key);
  }

  set<T>(key: string, value: T, ttl?: number) {
    return this.cacheManager.set<T>(key, value, ttl);
  }

  del(key: string) {
    return this.cacheManager.del(key);
  }
}
