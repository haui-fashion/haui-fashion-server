import { OllamaIntent } from '@core/modules/ollama/interfaces/intent-router.interface';

export const CHATBOT_TOOL_CALLING_MAX_ITERATIONS = 5;

export const CHATBOT_INTENT_TOOL_MODE: Record<
  OllamaIntent,
  'AUTO' | 'ANY' | 'NONE' | 'VALIDATED'
> = {
  SMALL_TALK: 'NONE',
  SEARCH_PRODUCT: 'ANY',
  MANAGE_ORDER: 'ANY',
  OUT_OF_SCOPE: 'NONE',
  UNKNOWN: 'AUTO'
};
