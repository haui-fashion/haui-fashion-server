import { GoogleGenAI } from '@google/genai';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { GEMINI_CLIENT } from '../gemini.provider';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name);
  private readonly model = 'gemini-2.5-flash';

  constructor(@Inject(GEMINI_CLIENT) private readonly ai: GoogleGenAI) {}

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
      throw new Error('Gemini returned no text response');
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
      throw new Error('Gemini returned no text response');
    }

    this.logger.debug(`Chat response: ${text.substring(0, 100)}...`);
    return text;
  }
}
