export const PRODUCT_EMBEDDING_SYNC_STATUS_CONFIG_PATHS = {
  timezone: 'timezone',
  embeddingTaskType: 'embedding.embeddingTaskType'
} as const;

export const DEFAULT_PRODUCT_EMBEDDING_SYNC_CONFIG = {
  timezone: 'Asia/Ho_Chi_Minh',
  embeddingTaskType: 'RETRIEVAL_DOCUMENT'
} as const;
