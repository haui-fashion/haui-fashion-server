import { GeminiProvider } from '@core/modules/gemini/gemini.provider';
import { GeminiBatchService } from '@core/modules/gemini/services/gemini-batch.service';
import { GeminiChatService } from '@core/modules/gemini/services/gemini-chat.service';
import { GeminiClientFactoryService } from '@core/modules/gemini/services/gemini-client-factory.service';
import { GeminiEmbeddingService } from '@core/modules/gemini/services/gemini-embedding.service';
import { GeminiExecutionService } from '@core/modules/gemini/services/gemini-execution.service';
import { GeminiGenerationService } from '@core/modules/gemini/services/gemini-generation.service';
import { GeminiImageService } from '@core/modules/gemini/services/gemini-image.service';
import { GeminiKeyPoolService } from '@core/modules/gemini/services/gemini-key-pool.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [
    GeminiProvider,
    GeminiKeyPoolService,
    GeminiClientFactoryService,
    GeminiExecutionService,
    GeminiEmbeddingService,
    GeminiChatService,
    GeminiImageService,
    GeminiGenerationService,
    GeminiBatchService
  ],
  exports: [
    GeminiProvider,
    GeminiKeyPoolService,
    GeminiClientFactoryService,
    GeminiExecutionService,
    GeminiEmbeddingService,
    GeminiChatService,
    GeminiImageService,
    GeminiGenerationService,
    GeminiBatchService
  ]
})
export class GeminiModule {}
