import {
  GEMINI_CHAT_MODEL,
  GEMINI_MODEL_CONFIG_PATHS
} from '@core/modules/gemini/constants/gemini.constants';
import { ChatMessage } from '@core/modules/gemini/entities/chat-message.entity';
import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GEMINI_CLIENT } from '../gemini.provider';

@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name);
  private readonly model: string;

  constructor(
    @Inject(GEMINI_CLIENT) private readonly ai: GoogleGenAI,
    private readonly configService: ConfigService
  ) {
    this.model =
      this.configService.get<string>(GEMINI_MODEL_CONFIG_PATHS.chat) ||
      GEMINI_CHAT_MODEL;
  }

  async generateContent(
    prompt: string,
    systemInstruction?: string
  ): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: prompt,
      ...(systemInstruction && {
        config: { systemInstruction }
      })
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini không trả về phản hồi văn bản');
    }

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

    const response = await this.ai.models.generateContent({
      model: this.model,
      contents,
      ...(systemInstruction && {
        config: { systemInstruction }
      })
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini không trả về phản hồi văn bản');
    }

    this.logger.debug(`Chat response: ${text.substring(0, 100)}...`);
    return text;
  }
}
