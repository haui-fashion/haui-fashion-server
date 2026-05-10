import {
  AppCacheKeys,
  AppCacheTtl
} from '@core/modules/app-cache/constants/app-cache.constant';
import { AppCacheService } from '@core/modules/app-cache/services/app-cache.service';
import {
  GEMINI_WORKLOAD,
  GeminiWorkload
} from '@core/modules/gemini/constants/gemini.constants';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

@Injectable()
export class GeminiKeyPoolService {
  private readonly logger = new Logger(GeminiKeyPoolService.name);
  private readonly regularKeys: string[];
  private readonly ultimateKey: string;
  private readonly ultimateOnly: boolean;
  private roundRobinCursor = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly appCacheService: AppCacheService
  ) {
    this.ultimateOnly =
      this.configService.get<boolean>('gemini.ultimateOnly') || false;
    this.ultimateKey =
      this.configService.get<string>('gemini.ultimateApiKey') || '';
    this.regularKeys = this.readRegularKeys();
  }

  getRegularKeyCount(): number {
    return this.regularKeys.length;
  }

  getUltimateKey(): string {
    return this.ultimateKey;
  }

  isUltimateOnlyEnabled(): boolean {
    return this.ultimateOnly;
  }

  async getOrderedRegularKeys(workload: GeminiWorkload): Promise<string[]> {
    if (this.ultimateOnly) return [];

    if (workload === GEMINI_WORKLOAD.image) return [];

    const candidates = this.rotateRegularKeys();
    const available: string[] = [];

    for (const key of candidates) {
      if (!(await this.isBlocked(key)) && !(await this.isInUse(key))) {
        available.push(key);
      }
    }

    return available;
  }

  async isBlocked(key: string): Promise<boolean> {
    const blocked = await this.appCacheService.get<boolean>(
      AppCacheKeys.geminiBlockedKey(this.getKeyFingerprint(key))
    );

    return Boolean(blocked);
  }

  async isInUse(key: string): Promise<boolean> {
    const inUse = await this.appCacheService.get<boolean>(
      AppCacheKeys.geminiInUseKey(this.getKeyFingerprint(key))
    );

    return Boolean(inUse);
  }

  async markInUse(key: string): Promise<void> {
    const fingerprint = this.getKeyFingerprint(key);
    await this.appCacheService.set(
      AppCacheKeys.geminiInUseKey(fingerprint),
      true,
      AppCacheTtl.geminiInUseKey
    );
  }

  async blockForRateLimit(key: string): Promise<void> {
    const fingerprint = this.getKeyFingerprint(key);
    await this.appCacheService.set(
      AppCacheKeys.geminiBlockedKey(fingerprint),
      true,
      AppCacheTtl.geminiBlockedKey
    );

    this.logger.warn(
      `Blocked Gemini key fingerprint=${fingerprint} for ${AppCacheTtl.geminiBlockedKey}ms due to 429`
    );
  }

  getKeyFingerprint(key: string): string {
    return createHash('sha256').update(key).digest('hex').slice(0, 12);
  }

  private readRegularKeys(): string[] {
    if (this.ultimateOnly) {
      this.logger.log(
        'Gemini ultimate-only mode enabled; regular key pool is disabled.'
      );
      return [];
    }

    const configuredKeys =
      this.configService.get<string[]>('gemini.apiKeys') || [];
    const normalizedKeys = [
      ...new Set(configuredKeys.map((key) => key.trim()).filter(Boolean))
    ].filter((key) => key !== this.ultimateKey);

    if (normalizedKeys.length === 0) {
      throw new Error(
        'Missing regular Gemini API keys. Set GEMINI_API_KEYS or GEMINI_API_KEY.'
      );
    }

    this.logger.log(`Loaded ${normalizedKeys.length} regular Gemini API keys`);
    return normalizedKeys;
  }

  private rotateRegularKeys(): string[] {
    if (this.regularKeys.length === 0) return [];

    const startIndex = this.roundRobinCursor % this.regularKeys.length;
    this.roundRobinCursor =
      (this.roundRobinCursor + 1) % this.regularKeys.length;

    return [
      ...this.regularKeys.slice(startIndex),
      ...this.regularKeys.slice(0, startIndex)
    ];
  }
}
