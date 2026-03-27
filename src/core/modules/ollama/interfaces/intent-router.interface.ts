export const OLLAMA_SUPPORTED_INTENTS = [
  'SMALL_TALK',
  'SEARCH_PRODUCT',
  'MANAGE_ORDER',
  'OUT_OF_SCOPE',
  'UNKNOWN'
] as const;

export type OllamaIntent = (typeof OLLAMA_SUPPORTED_INTENTS)[number];

export interface IntentRouterResult {
  intent: OllamaIntent;
}
