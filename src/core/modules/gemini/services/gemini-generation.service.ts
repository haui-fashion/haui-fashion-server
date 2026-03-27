import {
  GEMINI_GENERATION_MODEL,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL_CONFIG_PATHS
} from '@core/modules/gemini/constants/gemini.constants';
import {
  Content,
  GenerateContentConfig,
  GenerateContentResponse,
  GoogleGenAI
} from '@google/genai';
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

  async generate(params: {
    contents: string | Content[];
    model?: string;
    config?: GenerateContentConfig;
  }): Promise<GenerateContentResponse> {
    return this.ai.models.generateContent({
      model: params.model || this.model,
      contents: params.contents,
      config: {
        tools: [],
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        ...(params.config || {})
      }
    });
  }

  async generateText(params: {
    contents: string | Content[];
    model?: string;
    config?: GenerateContentConfig;
  }): Promise<string> {
    const response = await this.generate(params);
    const text = response.text;
    if (!text) {
      throw new Error('Gemini không trả về phản hồi văn bản');
    }

    return text;
  }
}
