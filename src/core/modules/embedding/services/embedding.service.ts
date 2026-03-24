import { HttpClientService } from '@core/modules/http-client/http-client.service';
import {
  Injectable,
  Logger,
  ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingRequest } from '../dtos/embedding-request.dto';
import { EmbeddingResponse } from '../dtos/embedding-response.dto';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpClientService: HttpClientService
  ) {
    this.baseUrl = this.configService.get<string>(
      'embedding.serviceUrl',
      'http://localhost:8000'
    );
    this.timeoutMs = this.configService.get<number>(
      'embedding.timeoutMs',
      30000
    );
  }

  async embedQuery(text: string, normalize?: boolean): Promise<number[]> {
    const response = await this.request('/query', {
      texts: [text],
      ...(normalize !== undefined ? { normalize } : {})
    });

    return response.embeddings[0] || [];
  }

  async embedPassage(text: string, normalize?: boolean): Promise<number[]> {
    const response = await this.request('/passage', {
      texts: [text],
      ...(normalize !== undefined ? { normalize } : {})
    });

    return response.embeddings[0] || [];
  }

  async embedQueryBatch(
    texts: string[],
    normalize?: boolean
  ): Promise<number[][]> {
    const response = await this.request('/query', {
      texts,
      ...(normalize !== undefined ? { normalize } : {})
    });

    return response.embeddings;
  }

  async embedPassageBatch(
    texts: string[],
    normalize?: boolean
  ): Promise<number[][]> {
    const response = await this.request('/passage', {
      texts,
      ...(normalize !== undefined ? { normalize } : {})
    });

    return response.embeddings;
  }

  private async request(
    endpoint: '/query' | '/passage',
    payload: EmbeddingRequest
  ): Promise<EmbeddingResponse> {
    if (payload.texts.length === 0) {
      return {
        model: 'unknown',
        dimension: 0,
        embeddings: []
      };
    }

    const url = this.buildUrl(endpoint);

    try {
      const data = await this.httpClientService.post<EmbeddingResponse>(
        url,
        payload,
        {
          timeoutMs: this.timeoutMs,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      this.logger.debug(
        `Generated ${data.embeddings.length} embeddings with dimension ${data.dimension}`
      );

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ServiceUnavailableException(
        `Embedding service is unavailable: ${message}`
      );
    }
  }

  private buildUrl(endpoint: '/query' | '/passage'): string {
    return `${this.baseUrl.replace(/\/$/, '')}${endpoint}`;
  }
}
