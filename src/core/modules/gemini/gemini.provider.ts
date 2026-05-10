import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';

export const GEMINI_CLIENT = 'GEMINI_CLIENT';

export const GeminiProvider = {
  provide: GEMINI_CLIENT,
  useFactory: (configService: ConfigService): GoogleGenAI => {
    const ultimateOnly = configService.get<boolean>('gemini.ultimateOnly');
    const apiKey = ultimateOnly
      ? configService.get<string>('gemini.ultimateApiKey')
      : configService.get<string>('gemini.apiKey') ||
        configService.get<string>('gemini.ultimateApiKey');
    return new GoogleGenAI({ apiKey: apiKey || '' });
  },
  inject: [ConfigService]
};
