import {
  IntentRouterResult,
  OLLAMA_SUPPORTED_INTENTS,
  OllamaIntent
} from '@core/modules/ollama/interfaces/intent-router.interface';
import { OllamaGenerationService } from '@core/modules/ollama/services/ollama-generation.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class OllamaIntentRouterService {
  private readonly logger = new Logger(OllamaIntentRouterService.name);

  constructor(
    private readonly ollamaGenerationService: OllamaGenerationService
  ) {}

  async routeIntent(message: string): Promise<IntentRouterResult> {
    const normalizedMessage = message.trim();

    if (!normalizedMessage) {
      return this.createUnknownIntent();
    }

    try {
      const text = await this.ollamaGenerationService.generateText({
        prompt: this.buildPrompt(normalizedMessage),
        system: this.buildSystemInstruction(),
        format: 'json',
        options: {
          temperature: 0,
          top_p: 0.9
        }
      });

      const parsed = this.parseJson(text);
      return this.normalizeIntentResult(parsed);
    } catch (error) {
      this.logger.warn(`Intent routing failed: ${(error as Error).message}`);
      return this.createUnknownIntent();
    }
  }

  private buildSystemInstruction(): string {
    return [
      'Bạn là một bộ phân loại intent cho website thương mại điện tử về ngành thời trang.',
      'Trả về chính xác một giá trị JSON hợp lệ duy nhất và không có gì khác.',
      'Nếu nội dung ngoài ngành thời trang hoặc không liên quan đến website, hãy trả về intent OUT_OF_SCOPE với confidence cao nếu chắc chắn.',
      'Chỉ dùng UNKNOWN khi không đủ thông tin để phân loại hoặc câu quá mơ hồ.',
      'Các intent được hỗ trợ: SMALL_TALK, SEARCH_PRODUCT, MANAGE_ORDER, OUT_OF_SCOPE, UNKNOWN.',
      'JSON schema: {"intent":"..."}.'
    ].join(' ');
  }

  private buildPrompt(message: string): string {
    return [
      'Phân loại tin nhắn của người dùng thành một intent duy nhất.',
      'Few-shot examples:',
      'Người dùng: "Xin chào shop"',
      'Output: {"intent":"SMALL_TALK"}',
      'Người dùng: "Tôi muốn tìm một chiếc áo thun màu đen size M dưới 1 triệu"',
      'Output: {"intent":"SEARCH_PRODUCT"}',
      'Người dùng: "Kiểm tra đơn hàng ORDER-12345 của tôi"',
      'Output: {"intent":"MANAGE_ORDER"}',
      'Người dùng: "Giải bài toán tích phân này giúp tôi"',
      'Output: {"intent":"OUT_OF_SCOPE"}',
      'Người dùng: "' + message.replace(/"/g, '\\"') + '"',
      'Output:'
    ].join('\n');
  }

  private parseJson(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Cannot parse JSON from Ollama response');
      }

      return JSON.parse(match[0]) as Record<string, unknown>;
    }
  }

  private normalizeIntentResult(
    payload: Record<string, unknown>
  ): IntentRouterResult {
    const intent = this.normalizeIntent(payload.intent);

    return {
      intent
    };
  }

  private normalizeIntent(value: unknown): OllamaIntent {
    if (typeof value !== 'string') {
      return 'UNKNOWN';
    }

    const intent = this.normalizeIntentAlias(value.trim().toUpperCase());

    if (
      OLLAMA_SUPPORTED_INTENTS.includes(
        intent as (typeof OLLAMA_SUPPORTED_INTENTS)[number]
      )
    ) {
      return intent as OllamaIntent;
    }

    return 'UNKNOWN';
  }

  private normalizeIntentAlias(intent: string): string {
    if (intent === 'NON_FASHION' || intent === 'NON_DOMAIN') {
      return 'OUT_OF_SCOPE';
    }

    if (intent === 'OUT_OF_DOMAIN' || intent === 'OUTSIDE_WEBSITE') {
      return 'OUT_OF_SCOPE';
    }

    return intent;
  }

  private normalizeConfidence(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return Math.round(value * 100) / 100;
  }

  private normalizeReason(value: unknown): string {
    if (typeof value !== 'string') {
      return 'No reason provided';
    }

    const normalized = value.trim();
    return normalized || 'No reason provided';
  }

  private createUnknownIntent(): IntentRouterResult {
    return {
      intent: 'UNKNOWN'
    };
  }
}
