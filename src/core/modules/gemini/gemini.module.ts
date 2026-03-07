import { GeminiProvider } from '@core/modules/gemini/gemini.provider';
import { GeminiChatService } from '@core/modules/gemini/services/gemini-chat.service';
import { GeminiEmbeddingService } from '@core/modules/gemini/services/gemini-embedding.service';
import { GeminiImageService } from '@core/modules/gemini/services/gemini-image.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [
    GeminiProvider,
    GeminiEmbeddingService,
    GeminiChatService,
    GeminiImageService
  ],
  exports: [GeminiEmbeddingService, GeminiChatService, GeminiImageService]
})
export class GeminiModule {}
