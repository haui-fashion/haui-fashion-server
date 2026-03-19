import {
  GEMINI_EMBEDDING_MODEL,
  GEMINI_MODEL_CONFIG_PATHS
} from '@core/modules/gemini/constants/gemini.constants';
import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEMINI_CLIENT } from '../gemini.provider';

@Injectable()
export class GeminiEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly ai: GoogleGenAI,
    private readonly configService: ConfigService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.embedding) ||
      GEMINI_EMBEDDING_MODEL;
  }

  async embedText(text: string, taskType?: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.model,
      contents: text,
      ...(taskType && { config: { taskType } })
    });

    const embedding = response.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error('Tạo embedding thất bại');
    }

    this.logger.debug(
      `Generated embedding with ${embedding.length} dimensions`
    );
    return embedding;
  }

  async embedBatch(texts: string[], taskType?: string): Promise<number[][]> {
    const response = await this.ai.models.embedContent({
      model: this.model,
      contents: texts,
      ...(taskType && { config: { taskType } })
    });

    const embeddings = response.embeddings?.map((e) => e.values ?? []);
    if (!embeddings || embeddings.length === 0) {
      throw new Error('Tạo embedding hàng loạt thất bại');
    }

    this.logger.debug(
      `Generated ${embeddings.length} embeddings, each with ${embeddings[0].length} dimensions`
    );
    return embeddings;
  }
}
