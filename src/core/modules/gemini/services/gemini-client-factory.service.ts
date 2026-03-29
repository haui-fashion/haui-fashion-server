import { GoogleGenAI } from '@google/genai';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GeminiClientFactoryService {
  private readonly clientsByKey = new Map<string, GoogleGenAI>();

  getClient(apiKey: string): GoogleGenAI {
    const cached = this.clientsByKey.get(apiKey);
    if (cached) {
      return cached;
    }

    const client = new GoogleGenAI({ apiKey });
    this.clientsByKey.set(apiKey, client);
    return client;
  }
}
