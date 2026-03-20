import { SummaryProductInformationDto } from '@components/product-embedding/dtos/summary-product-information.dto';
import { ProductSummary } from '@components/product-embedding/entities/product-summary.entity';
import { GeminiGenerationService } from '@core/modules/gemini';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProductEmbeddingSummaryService {
  private readonly logger = new Logger(ProductEmbeddingSummaryService.name);

  constructor(
    private readonly geminiGenerationService: GeminiGenerationService
  ) {}

  async summarizeBatch(
    inputs: SummaryProductInformationDto[]
  ): Promise<ProductSummary[]> {
    if (inputs.length === 0) {
      return [];
    }

    const prompt = `Bạn là chuyên gia chuẩn hóa dữ liệu sản phẩm thời trang cho hệ thống semantic search.
    Trả về mảng JSON hợp lệ theo đúng thứ tự đầu vào, mỗi phần tử có shortDescription, semanticContext, noiseReducedAttributes.
    Không thêm markdown.
    Dữ liệu: ${JSON.stringify(inputs)}`;

    const text = await this.geminiGenerationService.generateText({
      contents: [{ text: prompt }],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = this.parseJsonArray(text);

    const results = parsed.map((item) => {
      const result = new ProductSummary();
      result.shortDescription = this.pickString(item.shortDescription);
      result.semanticContext = this.pickString(item.semanticContext);
      result.noiseReducedAttributes = this.pickStringArray(
        item.noiseReducedAttributes
      );
      return result;
    });

    if (results.length !== inputs.length) {
      throw new Error('Missing summary batch results');
    }

    results.forEach((result) => {
      if (!result.shortDescription || !result.semanticContext) {
        throw new Error('Missing shortDescription/semanticContext Gemini');
      }
    });

    this.logger.debug(`Generated summary batch with ${results.length} items`);
    return results;
  }

  private parseJsonArray(text: string): Record<string, unknown>[] {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('Summary batch response is not an array');
      }
      return parsed as Record<string, unknown>[];
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        throw new Error('Cannot parse JSON from Gemini');
      }
      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error('Summary batch response is not an array');
      }
      return parsed as Record<string, unknown>[];
    }
  }

  private pickString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private pickStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}
