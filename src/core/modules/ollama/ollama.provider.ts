import { HttpClientService } from '@core/modules/http-client/http-client.service';
import {
  OLLAMA_CONFIG_PATHS,
  OLLAMA_DEFAULT_BASE_URL
} from '@core/modules/ollama/constants/ollama.constants';
import { ConfigService } from '@nestjs/config';

export const OLLAMA_CLIENT = 'OLLAMA_CLIENT';

export type OllamaGenerateRequest = {
  model: string;
  prompt: string;
  system?: string;
  options?: Record<string, unknown>;
  format?: 'json' | Record<string, unknown>;
  keep_alive?: string | number;
  stream?: boolean;
};

export type OllamaGenerateResponse = {
  model: string;
  response: string;
  done: boolean;
  done_reason?: string;
  created_at?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

export interface OllamaClient {
  generate(payload: OllamaGenerateRequest): Promise<OllamaGenerateResponse>;
}

export const OllamaProvider = {
  provide: OLLAMA_CLIENT,
  useFactory: (
    configService: ConfigService,
    httpClientService: HttpClientService
  ): OllamaClient => {
    const baseUrl =
      configService.get<string>(OLLAMA_CONFIG_PATHS.baseUrl) ||
      OLLAMA_DEFAULT_BASE_URL;
    const timeoutMs =
      configService.get<number>(OLLAMA_CONFIG_PATHS.timeoutMs) || 20000;

    const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

    return {
      async generate(
        payload: OllamaGenerateRequest
      ): Promise<OllamaGenerateResponse> {
        return httpClientService.post<OllamaGenerateResponse>(
          `${normalizedBaseUrl}/api/generate`,
          {
            stream: false,
            ...payload
          },
          {
            timeoutMs
          }
        );
      }
    };
  },
  inject: [ConfigService, HttpClientService]
};
