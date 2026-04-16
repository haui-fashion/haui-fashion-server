import {
  GEMINI_WORKLOAD,
  GeminiWorkload
} from '@core/modules/gemini/constants/gemini.constants';
import { GoogleGenAI } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { GeminiClientFactoryService } from './gemini-client-factory.service';
import { GeminiKeyPoolService } from './gemini-key-pool.service';

type GeminiOperation<T> = (client: GoogleGenAI) => Promise<T>;

@Injectable()
export class GeminiExecutionService {
  private readonly logger = new Logger(GeminiExecutionService.name);
  private readonly inUseRefreshIntervalMs = 5000;

  constructor(
    private readonly geminiKeyPoolService: GeminiKeyPoolService,
    private readonly geminiClientFactoryService: GeminiClientFactoryService
  ) {}

  async execute<T>(params: {
    workload: GeminiWorkload;
    operation: GeminiOperation<T>;
  }): Promise<T> {
    if (params.workload === GEMINI_WORKLOAD.image) {
      return this.executeWithUltimateKey(params.workload, params.operation);
    }

    if (params.workload === GEMINI_WORKLOAD.text) {
      return this.executeTextWithUltimateFallback(params.operation);
    }

    return this.executeWithRegularKeysOnly(params.workload, params.operation);
  }

  private async executeTextWithUltimateFallback<T>(
    operation: GeminiOperation<T>
  ): Promise<T> {
    const regularKeys = await this.geminiKeyPoolService.getOrderedRegularKeys(
      GEMINI_WORKLOAD.text
    );

    let lastRateLimitError: unknown;
    for (let index = 0; index < regularKeys.length; index += 1) {
      const key = regularKeys[index];

      try {
        return await this.executeWithKeyLease(key, operation);
      } catch (error) {
        if (!this.isRateLimitError(error)) {
          throw error;
        }

        await this.geminiKeyPoolService.blockForRateLimit(key);
        lastRateLimitError = error;
        this.logger.warn(
          `Gemini text workload rate-limited on regular key ${index + 1}/${regularKeys.length}; trying next key`
        );
      }
    }

    const ultimateKey = this.geminiKeyPoolService.getUltimateKey();
    if (await this.geminiKeyPoolService.isBlocked(ultimateKey)) {
      throw this.createExhaustedError(
        GEMINI_WORKLOAD.text,
        lastRateLimitError,
        'Ultimate key is temporarily blocked by 429 cooldown'
      );
    }

    try {
      return await operation(
        this.geminiClientFactoryService.getClient(ultimateKey)
      );
    } catch (error) {
      if (!this.isRateLimitError(error)) {
        throw error;
      }

      await this.geminiKeyPoolService.blockForRateLimit(ultimateKey);
      throw this.createExhaustedError(
        GEMINI_WORKLOAD.text,
        error,
        'Regular pool exhausted and ultimate key also rate-limited'
      );
    }
  }

  private async executeWithRegularKeysOnly<T>(
    workload: GeminiWorkload,
    operation: GeminiOperation<T>
  ): Promise<T> {
    const regularKeys =
      await this.geminiKeyPoolService.getOrderedRegularKeys(workload);
    if (regularKeys.length === 0) {
      throw this.createExhaustedError(
        workload,
        null,
        'No regular Gemini API key is currently available'
      );
    }

    let lastRateLimitError: unknown;
    for (let index = 0; index < regularKeys.length; index += 1) {
      const key = regularKeys[index];

      try {
        return await this.executeWithKeyLease(key, operation);
      } catch (error) {
        if (!this.isRateLimitError(error)) {
          throw error;
        }

        await this.geminiKeyPoolService.blockForRateLimit(key);
        lastRateLimitError = error;
        this.logger.warn(
          `Gemini ${workload} workload rate-limited on regular key ${index + 1}/${regularKeys.length}; trying next key`
        );
      }
    }

    throw this.createExhaustedError(
      workload,
      lastRateLimitError,
      'All regular Gemini keys are rate-limited'
    );
  }

  private async executeWithUltimateKey<T>(
    workload: GeminiWorkload,
    operation: GeminiOperation<T>
  ): Promise<T> {
    const ultimateKey = this.geminiKeyPoolService.getUltimateKey();
    if (await this.geminiKeyPoolService.isBlocked(ultimateKey)) {
      throw this.createExhaustedError(
        workload,
        null,
        'Ultimate key is temporarily blocked by 429 cooldown'
      );
    }

    try {
      return await operation(
        this.geminiClientFactoryService.getClient(ultimateKey)
      );
    } catch (error) {
      if (!this.isRateLimitError(error)) {
        throw error;
      }

      await this.geminiKeyPoolService.blockForRateLimit(ultimateKey);
      throw this.createExhaustedError(
        workload,
        error,
        'Ultimate key is rate-limited'
      );
    }
  }

  private createExhaustedError(
    workload: GeminiWorkload,
    error: unknown,
    reason: string
  ): Error {
    const message = `Gemini key rotation exhausted for workload=${workload}. ${reason}.`;
    const exhaustedError = new Error(message);

    if (error) {
      (exhaustedError as Error & { cause?: unknown }).cause = error;
    }

    return exhaustedError;
  }

  private async executeWithKeyLease<T>(
    key: string,
    operation: GeminiOperation<T>
  ): Promise<T> {
    await this.geminiKeyPoolService.markInUse(key);

    const refreshTimer = setInterval(() => {
      void this.geminiKeyPoolService.markInUse(key);
    }, this.inUseRefreshIntervalMs);

    try {
      return await operation(this.geminiClientFactoryService.getClient(key));
    } finally {
      clearInterval(refreshTimer);
    }
  }

  private isRateLimitError(error: unknown): boolean {
    const candidate = error as {
      status?: number | string;
      code?: number | string;
      message?: string;
      error?: { code?: number | string; message?: string };
      response?: {
        status?: number | string;
        data?: { error?: { message?: string } };
      };
    };

    const status =
      candidate?.status ??
      candidate?.code ??
      candidate?.error?.code ??
      candidate?.response?.status;
    if (status === 429 || status === '429') {
      return true;
    }

    const message = [
      candidate?.message,
      candidate?.error?.message,
      candidate?.response?.data?.error?.message
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return message.includes('429') || message.includes('rate limit');
  }
}
