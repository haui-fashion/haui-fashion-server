import {
  GEMINI_GENERATION_MODEL,
  GEMINI_MAX_OUTPUT_TOKENS,
  GEMINI_MODEL_CONFIG_PATHS,
  GEMINI_WORKLOAD,
  GeminiWorkload
} from '@core/modules/gemini/constants/gemini.constants';
import {
  Content,
  GenerateContentConfig,
  GenerateContentResponse
} from '@google/genai';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiExecutionService } from './gemini-execution.service';

@Injectable()
export class GeminiGenerationService {
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiExecutionService: GeminiExecutionService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.generation) ||
      GEMINI_GENERATION_MODEL;
  }

  async generate(params: {
    contents: string | Content[];
    model?: string;
    config?: GenerateContentConfig;
    workload?: GeminiWorkload;
  }): Promise<GenerateContentResponse> {
    return this.geminiExecutionService.execute({
      workload: params.workload || GEMINI_WORKLOAD.text,
      operation: (client) =>
        client.models.generateContent({
          model: params.model || this.model,
          contents: params.contents,
          config: {
            tools: [],
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            ...(params.config || {})
          }
        })
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
