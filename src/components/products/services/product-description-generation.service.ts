import { PRODUCT_DESCRIPTION_RESPONSE_SCHEMA } from '@components/products/constants/product-description.constants';
import { GenerateProductDescriptionDto } from '@components/products/dtos/generate-product-description.dto';
import { GeneratedProductDescription } from '@components/products/entities/generated-product-description.entity';
import { GeminiGenerationService } from '@core/modules/gemini';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductDescriptionGenerationService {
  constructor(
    private readonly geminiGenerationService: GeminiGenerationService
  ) {}

  async generateProductSections(
    input: GenerateProductDescriptionDto
  ): Promise<GeneratedProductDescription> {
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
      'Trường bắt buộc cần rõ ràng gồm productName, shortPreview, shortDescription và preserver. ' +
      'shortDescription phải là đoạn mô tả semantic, gom các trường chính của sản phẩm (danh mục, giới tính, phong cách, chất liệu, form, mùa, thương hiệu) và ngữ cảnh sử dụng phù hợp. ' +
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

    const text = await this.geminiGenerationService.generateText({
      contents: [{ role: 'user', parts: contents }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: PRODUCT_DESCRIPTION_RESPONSE_SCHEMA
      }
    });

    const parsed = this.parseJson(text);

    const result: GeneratedProductDescription = {
      productName: this.pickString(parsed.productName, input.name),
      shortPreview: this.pickString(parsed.shortPreview, ''),
      keyFeatures: this.pickStringArray(parsed.keyFeatures),
      materialAndBuild: this.pickStringArray(parsed.materialAndBuild),
      preserver: this.pickStringArray(parsed.preserver),
      sizeAndFit: this.pickStringArray(parsed.sizeAndFit),
      stylingSuggestions: this.pickStringArray(parsed.stylingSuggestions),
      packageIncludes: this.pickStringArray(parsed.packageIncludes),
      seoKeywords: this.pickStringArray(parsed.seoKeywords),
      shortDescription: this.buildSemanticShortDescription(
        input,
        this.pickString(parsed.shortDescription, ''),
        this.pickString(parsed.shortPreview, ''),
        this.pickStringArray(parsed.keyFeatures)
      )
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

  private buildSemanticShortDescription(
    input: GenerateProductDescriptionDto,
    generatedShortDescription: string,
    shortPreview: string,
    keyFeatures: string[]
  ): string {
    if (generatedShortDescription) {
      return generatedShortDescription;
    }

    const semanticParts = [
      input.categoryName
        ? `Danh mục ${input.categoryName}`
        : 'Danh mục chưa xác định',
      input.gender ? `phù hợp ${input.gender}` : null,
      input.styleTags?.length
        ? `phong cách ${input.styleTags.join(', ')}`
        : null,
      input.material ? `chất liệu ${input.material}` : null,
      input.fit ? `form ${input.fit}` : null,
      input.season ? `dùng tốt mùa ${input.season}` : null,
      input.brand ? `thương hiệu ${input.brand}` : null,
      keyFeatures.length > 0
        ? `điểm nhấn ${keyFeatures.slice(0, 3).join(', ')}`
        : null,
      shortPreview || null
    ].filter((part): part is string => Boolean(part));

    return semanticParts.join('. ');
  }
}
