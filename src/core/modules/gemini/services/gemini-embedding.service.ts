import {
  GEMINI_EMBEDDING_MODEL,
  GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
  GEMINI_MODEL_CONFIG_PATHS,
  GEMINI_WORKLOAD
} from '@core/modules/gemini/constants/gemini.constants';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiExecutionService } from './gemini-execution.service';

@Injectable()
export class GeminiEmbeddingService {
  private readonly logger = new Logger(GeminiEmbeddingService.name);
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiExecutionService: GeminiExecutionService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.embedding) ||
      GEMINI_EMBEDDING_MODEL;
  }

  async embedText(text: string, taskType?: string): Promise<number[]> {
    const response = await this.geminiExecutionService.execute({
      workload: GEMINI_WORKLOAD.embedding,
      operation: (client) =>
        client.models.embedContent({
          model: this.model,
          contents: text,
          config: {
            outputDimensionality: GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
            ...(taskType && { taskType })
          }
        })
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
    const response = await this.geminiExecutionService.execute({
      workload: GEMINI_WORKLOAD.embedding,
      operation: (client) =>
        client.models.embedContent({
          model: this.model,
          contents: texts,
          config: {
            outputDimensionality: GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY,
            ...(taskType && { taskType })
          }
        })
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
