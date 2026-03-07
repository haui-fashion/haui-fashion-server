import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { GEMINI_CLIENT } from '../gemini.provider';

export interface ImageGenerationResult {
  base64: string;
  mimeType: string;
  text?: string;
}

@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);
  private readonly model = 'gemini-2.5-flash-image';

  constructor(@Inject(GEMINI_CLIENT) private readonly ai: GoogleGenAI) {}

  async generateImage(prompt: string): Promise<ImageGenerationResult> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt
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

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents
    });

    return this.extractImageFromResponse(response);
  }

  async virtualTryOn(
    clothingImageBase64: string,
    clothingMimeType: string,
    modelImageBase64: string,
    modelMimeType: string,
    prompt?: string
  ): Promise<ImageGenerationResult> {
    const defaultPrompt =
      'Generate a realistic virtual try-on image showing the person wearing the clothing item. ' +
      "Maintain the person's body shape, skin tone, and pose. " +
      'The clothing should fit naturally and look realistic.';

    const contents = [
      { text: prompt || defaultPrompt },
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

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents
    });

    return this.extractImageFromResponse(response);
  }

  private extractImageFromResponse(response: any): ImageGenerationResult {
    const result: ImageGenerationResult = {
      base64: '',
      mimeType: 'image/png'
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parts = response?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      throw new Error('Gemini returned no image response');
    }

    for (const part of parts as Array<{
      text?: string;
      inlineData?: { data: string; mimeType: string };
    }>) {
      if (part.text) {
        result.text = part.text;
      } else if (part.inlineData) {
        result.base64 = part.inlineData.data;
        result.mimeType = part.inlineData.mimeType || 'image/png';
      }
    }

    if (!result.base64) {
      throw new Error('Gemini returned no image data');
    }

    this.logger.debug(
      `Generated image: ${result.mimeType}, ${Math.round((result.base64.length * 0.75) / 1024)}KB`
    );
    return result;
  }
}
