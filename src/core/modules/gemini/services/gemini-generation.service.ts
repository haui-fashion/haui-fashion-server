import {
  GEMINI_GENERATION_MODEL,
  GEMINI_MODEL_CONFIG_PATHS,
  GEMINI_PRODUCT_DESCRIPTION_RESPONSE_SCHEMA
} from '@core/modules/gemini/constants/gemini.constants';
import { GeminiGenerateProductDescriptionDto } from '@core/modules/gemini/dtos/generate-product-description-input.dto';
import { GeminiGeneratedDescription } from '@core/modules/gemini/entities/gemini-generated-description.entity';
import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEMINI_CLIENT } from '../gemini.provider';

@Injectable()
export class GeminiGenerationService {
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly ai: GoogleGenAI,
    private readonly configService: ConfigService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.generation) ||
      GEMINI_GENERATION_MODEL;
  }

  async generateProductSections(
    input: GeminiGenerateProductDescriptionDto
  ): Promise<GeminiGeneratedDescription> {
    const productContext = {
      name: input.name,
      brand: input.brand,
      gender: input.gender,
      styleTags: input.styleTags || [],
      material: input.material,
      season: input.season,
      fit: input.fit,
      categoryName: input.categoryName,
      highlights: input.highlights || []
    };

    const textPrompt =
      'Bạn là chuyên gia viết mô tả sản phẩm thời trang e-commerce. ' +
      `Hãy phân tích dữ liệu sản phẩm và ảnh (nếu có), rồi tạo JSON đúng schema bằng ngôn ngữ Việt Nam. ` +
      'Yêu cầu nội dung ngắn gọn, giàu thông tin, phù hợp đăng bán trực tuyến và KHÔNG bịa đặt quá mức. ' +
      'Trường bắt buộc cần rõ ràng gồm productName, shortPreview và preserver. ' +
      'preserver phải là danh sách hướng dẫn bảo quản cụ thể cho khách hàng.' +
      `\n\nDữ liệu sản phẩm:\n${JSON.stringify(productContext, null, 2)}`;

    const contents: Array<{
      text?: string;
      inlineData?: { data: string; mimeType: string };
    }> = [{ text: textPrompt }];

    if (input.images && input.images.length) {
      for (const [index, image] of input.images.entries()) {
        if (image.base64) {
          contents.push({
            inlineData: {
              data: image.base64,
              mimeType: image.mimeType || 'image/jpeg'
            }
          });
          continue;
        }

        if (image.url) {
          contents.push({
            text: `Image URL ${index + 1}: ${image.url}`
          });
        }
      }
    }

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: GEMINI_PRODUCT_DESCRIPTION_RESPONSE_SCHEMA
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini không trả về dữ liệu mô tả sản phẩm');
    }

    const parsed = this.parseJson(text);

    const result: GeminiGeneratedDescription = {
      productName: this.pickString(parsed.productName, input.name),
      shortPreview: this.pickString(parsed.shortPreview, ''),
      keyFeatures: this.pickStringArray(parsed.keyFeatures),
      materialAndBuild: this.pickStringArray(parsed.materialAndBuild),
      preserver: this.pickStringArray(parsed.preserver),
      sizeAndFit: this.pickStringArray(parsed.sizeAndFit),
      stylingSuggestions: this.pickStringArray(parsed.stylingSuggestions),
      packageIncludes: this.pickStringArray(parsed.packageIncludes),
      seoKeywords: this.pickStringArray(parsed.seoKeywords)
    };

    if (!result.shortPreview) {
      throw new Error('Gemini thiếu trường shortPreview trong kết quả');
    }
    if (result.preserver.length === 0) {
      throw new Error('Gemini thiếu trường preserver trong kết quả');
    }

    return result;
  }

  private parseJson(text: string): Record<string, unknown> {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error('Không thể parse JSON từ phản hồi Gemini');
      }
      return JSON.parse(match[0]) as Record<string, unknown>;
    }
  }

  private pickString(value: unknown, fallback: string): string {
    if (typeof value !== 'string') {
      return fallback;
    }

    const nextValue = value.trim();
    return nextValue || fallback;
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
