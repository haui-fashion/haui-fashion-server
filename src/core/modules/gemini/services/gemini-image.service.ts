import {
  GEMINI_DEFAULT_IMAGE_MIME_TYPE,
  GEMINI_IMAGE_MODEL,
  GEMINI_MODEL_CONFIG_PATHS
} from '@core/modules/gemini/constants/gemini.constants';
import { ImageGenerationResult } from '@core/modules/gemini/entities/image-generation-result.entity';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiGenerationService } from './gemini-generation.service';

@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiGenerationService: GeminiGenerationService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.image) ||
      GEMINI_IMAGE_MODEL;
  }

  async generateImage(prompt: string): Promise<ImageGenerationResult> {
    const response = await this.geminiGenerationService.generate({
      model: this.model,
      contents: prompt,
      config: {
        responseModalities: ['IMAGE']
      }
    });

    return this.extractImageFromResponse(response);
  }

  async editImage(
    prompt: string,
    imageBase64: string,
    mimeType: string
  ): Promise<ImageGenerationResult> {
    const contents = [
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: imageBase64
        }
      }
    ];

    const response = await this.geminiGenerationService.generate({
      model: this.model,
      contents: [{ role: 'user', parts: contents }],
      config: {
        responseModalities: ['IMAGE']
      }
    });

    return this.extractImageFromResponse(response);
  }

  async virtualTryOn(
    clothingImageBase64: string,
    clothingMimeType: string,
    modelImageBase64: string,
    modelMimeType: string,
    garmentType?: string
  ): Promise<ImageGenerationResult> {
    const prompt = this.buildVtonPrompt(garmentType);

    const contents = [
      { text: prompt },
      {
        inlineData: {
          mimeType: clothingMimeType,
          data: clothingImageBase64
        }
      },
      {
        inlineData: {
          mimeType: modelMimeType,
          data: modelImageBase64
        }
      }
    ];

    const response = await this.geminiGenerationService.generate({
      model: this.model,
      contents: [{ role: 'user', parts: contents }],
      config: {
        responseModalities: ['IMAGE']
      }
    });

    return this.extractImageFromResponse(response);
  }

  private buildVtonPrompt(garmentType?: string): string {
    const garmentHint = garmentType
      ? `Sản phẩm thời trang là: ${garmentType}.`
      : 'Hãy xác định loại sản phẩm thời trang (áo, quần, váy, áo khoác, giày, phụ kiện, v.v.) từ hình ảnh thứ nhất.';

    return [
      'Bạn là một hệ thống thử đồ ảo (virtual try-on) chuyên nghiệp cho nền tảng thương mại điện tử thời trang.',
      '',
      'NHIỆM VỤ: Tạo ra duy nhất một hình ảnh chân thực (photorealistic) của người mẫu (hình ảnh thứ hai) đang mặc sản phẩm thời trang (hình ảnh thứ nhất).',
      '',
      `${garmentHint}`,
      '',
      'NGUYÊN TẮC:',
      '- GIỮ NGUYÊN hoàn toàn khuôn mặt, vóc dáng, màu da, kiểu tóc và tư thế của người mẫu.',
      '- ĐIỀU CHỈNH trang phục vừa vặn tự nhiên theo cơ thể, đúng tỷ lệ và dáng đứng.',
      '- ĐỒNG BỘ ánh sáng, bóng đổ và nhiệt độ màu với ảnh người mẫu.',
      '- TÁI HIỆN chi tiết vải một cách chân thực: nếp nhăn, độ rủ, độ gấp và texture.',
      '- GIỮ NGUYÊN các trang phục khác mà người mẫu đang mặc — chỉ thay thế đúng sản phẩm liên quan.',
      '- Đối với giày: hiển thị đúng vị trí trên chân, đúng phối cảnh và có bóng đổ tiếp đất.',
      '- Đối với phụ kiện (mũ, túi, đồng hồ, kính, trang sức): đặt đúng vị trí tự nhiên.',
      '- Kết quả đầu ra là một hình ảnh chất lượng cao, toàn thân hoặc phần cơ thể phù hợp, không chứa chữ, watermark hoặc ghép ảnh (collage).'
    ].join('\n');
  }

  private extractImageFromResponse(response: any): ImageGenerationResult {
    const result: ImageGenerationResult = {
      base64: '',
      mimeType: GEMINI_DEFAULT_IMAGE_MIME_TYPE
    };

    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      throw new Error('Gemini không trả về phản hồi hình ảnh');
    }

    for (const part of parts as Array<{
      text?: string;
      inlineData?: { data: string; mimeType: string };
    }>) {
      if (part.text) {
        result.text = part.text;
      } else if (part.inlineData) {
        result.base64 = part.inlineData.data;
        result.mimeType =
          part.inlineData.mimeType || GEMINI_DEFAULT_IMAGE_MIME_TYPE;
      }
    }

    if (!result.base64) {
      throw new Error('Gemini không có dữ liệu hình ảnh');
    }

    this.logger.debug(
      `Generated image: ${result.mimeType}, ${Math.round((result.base64.length * 0.75) / 1024)}KB`
    );
    return result;
  }
}
