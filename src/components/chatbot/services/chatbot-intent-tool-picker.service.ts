import { CHATBOT_INTENT_TOOL_MODE } from '@components/chatbot/constants/chatbot-tooling.constants';
import { GeminiToolBundle } from '@components/chatbot/interfaces/chatbot-tooling.interface';
import { ChatbotToolCatalogService } from '@components/chatbot/services/chatbot-tool-catalog.service';
import { OllamaIntent } from '@core/modules/ollama/interfaces/intent-router.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ChatbotIntentToolPickerService {
  constructor(private readonly toolCatalogService: ChatbotToolCatalogService) {}

  pickByIntent(intent: OllamaIntent): GeminiToolBundle {
    const declarations =
      this.toolCatalogService.getFunctionDeclarations(intent);
    const mode = CHATBOT_INTENT_TOOL_MODE[intent];
    const allowedFunctionNames = declarations.map((item) => item.name);

    return {
      declarations,
      mode,
      allowedFunctionNames
    };
  }
}
