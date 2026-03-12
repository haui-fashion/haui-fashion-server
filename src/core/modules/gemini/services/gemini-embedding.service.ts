import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { GEMINI_CLIENT } from '../gemini.provider';

@Injectable()
export class GeminiEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly model = 'gemini-embedding-001';

  constructor(@Inject(GEMINI_CLIENT) private readonly ai: GoogleGenAI) {}

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
