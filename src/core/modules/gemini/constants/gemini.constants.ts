export const GEMINI_CHAT_MODEL = 'gemini-2.5-flash';
export const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001';
export const GEMINI_GENERATION_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODEL_CONFIG_PATHS = {
  chat: 'gemini.models.chat',
  image: 'gemini.models.image',
  embedding: 'gemini.models.embedding',
  generation: 'gemini.models.generation'
} as const;

export const GEMINI_DEFAULT_IMAGE_MIME_TYPE = 'image/png';

export const GEMINI_PRODUCT_DESCRIPTION_REQUIRED_FIELDS = [
  'productName',
  'shortPreview',
  'keyFeatures',
  'materialAndBuild',
  'preserver',
  'sizeAndFit',
  'stylingSuggestions',
  'packageIncludes',
  'seoKeywords'
] as const;

export const GEMINI_PRODUCT_DESCRIPTION_RESPONSE_SCHEMA = {
  type: 'object',
  required: [...GEMINI_PRODUCT_DESCRIPTION_REQUIRED_FIELDS],
  properties: {
    productName: { type: 'string' },
    shortPreview: { type: 'string' },
    keyFeatures: {
      type: 'array',
      items: { type: 'string' }
    },
    materialAndBuild: {
      type: 'array',
      items: { type: 'string' }
    },
    preserver: {
      type: 'array',
      items: { type: 'string' }
    },
    sizeAndFit: {
      type: 'array',
      items: { type: 'string' }
    },
    stylingSuggestions: {
      type: 'array',
      items: { type: 'string' }
    },
    packageIncludes: {
      type: 'array',
      items: { type: 'string' }
    },
    seoKeywords: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const;
