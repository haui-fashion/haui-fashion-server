export const PRODUCT_DESCRIPTION_REQUIRED_FIELDS = [
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

export const PRODUCT_DESCRIPTION_RESPONSE_SCHEMA = {
  type: 'object',
  required: [...PRODUCT_DESCRIPTION_REQUIRED_FIELDS],
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
