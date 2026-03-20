export const GEMINI_CHAT_MODEL = 'gemini-2.5-flash';
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const GEMINI_GENERATION_MODEL = 'gemini-2.5-flash';
export const GEMINI_MAX_OUTPUT_TOKENS = 2048;
export const GEMINI_EMBEDDING_OUTPUT_DIMENSIONALITY = 768;

export const GEMINI_MODEL_CONFIG_PATHS = {
  chat: 'gemini.models.chat',
  image: 'gemini.models.image',
  embedding: 'gemini.models.embedding',
  generation: 'gemini.models.generation'
} as const;

export const GEMINI_DEFAULT_IMAGE_MIME_TYPE = 'image/png';
