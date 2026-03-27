import { OllamaController } from '@core/modules/ollama/controllers/ollama.controller';
import { OllamaProvider } from '@core/modules/ollama/ollama.provider';
import { OllamaGenerationService } from '@core/modules/ollama/services/ollama-generation.service';
import { OllamaIntentRouterService } from '@core/modules/ollama/services/ollama-intent-router.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [
    OllamaProvider,
    OllamaGenerationService,
    OllamaIntentRouterService
  ],
  exports: [OllamaProvider, OllamaGenerationService, OllamaIntentRouterService],
  controllers: [OllamaController]
})
export class OllamaModule {}
