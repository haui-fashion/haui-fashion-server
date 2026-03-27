import { OllamaGenerationService } from '@core/modules/ollama/services/ollama-generation.service';
import { OllamaIntentRouterService } from '@core/modules/ollama/services/ollama-intent-router.service';
import { Roles } from '@core/utilities/decorators';
import { Body, Controller, Post } from '@nestjs/common';
import { Role } from '@prisma/client';

@Controller('ollama')
export class OllamaController {
  constructor(
    private readonly ollamaGenerationService: OllamaGenerationService,
    private readonly ollamaIntentRouterService: OllamaIntentRouterService
  ) {}

  @Roles(Role.ADMIN)
  @Post('generate')
  async generate(@Body() body: any) {
    return this.ollamaGenerationService.generateText({
      prompt: body.message
    });
  }

  @Roles(Role.ADMIN)
  @Post('route-intent')
  async routeIntent(@Body() body: any) {
    return this.ollamaIntentRouterService.routeIntent(body.message);
  }
}
