import {
  OLLAMA_CONFIG_PATHS,
  OLLAMA_ROUTER_MODEL
} from '@core/modules/ollama/constants/ollama.constants';
import {
  OLLAMA_CLIENT,
  OllamaClient,
  OllamaGenerateResponse
} from '@core/modules/ollama/ollama.provider';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OllamaGenerationService {
  private readonly model: string;

  constructor(
    @Inject(OLLAMA_CLIENT) private readonly ollamaClient: OllamaClient,
    private readonly configService: ConfigService
  ) {
    this.model =
      this.configService.get<string>(OLLAMA_CONFIG_PATHS.routerModel) ||
      OLLAMA_ROUTER_MODEL;
  }

  async generate(params: {
    prompt: string;
    model?: string;
    system?: string;
    options?: Record<string, unknown>;
    format?: 'json' | Record<string, unknown>;
    keepAlive?: string | number;
  }): Promise<OllamaGenerateResponse> {
    return this.ollamaClient.generate({
      model: params.model || this.model,
      prompt: params.prompt,
      system: params.system,
      options: params.options,
      format: params.format,
      keep_alive: params.keepAlive,
      stream: false
    });
  }

  async generateText(params: {
    prompt: string;
    model?: string;
    system?: string;
    options?: Record<string, unknown>;
    format?: 'json' | Record<string, unknown>;
    keepAlive?: string | number;
  }): Promise<string> {
    const response = await this.generate({
      ...params,
      format: params.format
    });
    if (!response.response) {
      throw new Error('Ollama không trả về phản hồi');
    }

    return response.response;
  }
}
