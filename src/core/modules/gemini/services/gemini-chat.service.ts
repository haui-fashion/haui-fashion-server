import {
  GEMINI_CHAT_MODEL,
  GEMINI_MODEL_CONFIG_PATHS
} from '@core/modules/gemini/constants/gemini.constants';
import { ChatMessage } from '@core/modules/gemini/entities/chat-message.entity';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiGenerationService } from './gemini-generation.service';

@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name);
  private readonly model: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiGenerationService: GeminiGenerationService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.chat) ||
      GEMINI_CHAT_MODEL;
  }

  async generateContent(
    prompt: string,
    systemInstruction?: string
  ): Promise<string> {
    const text = await this.geminiGenerationService.generateText({
      contents: prompt,
      model: this.model,
      config: {
        ...(systemInstruction && { systemInstruction })
      }
    });

    this.logger.debug(`Generated content: ${text.substring(0, 100)}...`);
    return text;
  }

  async chat(
    history: ChatMessage[],
    message: string,
    systemInstruction?: string
  ): Promise<string> {
    const contents = [
      ...history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      })),
      {
        role: 'user' as const,
        parts: [{ text: message }]
      }
    ];

    const text = await this.geminiGenerationService.generateText({
      contents,
      model: this.model,
      config: {
        ...(systemInstruction && { systemInstruction })
      }
    });

    this.logger.debug(`Chat response: ${text.substring(0, 100)}...`);
    return text;
  }
}
