-- Enable pgvector for semantic embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Create enum for product embedding sync lifecycle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmbeddingSyncStatus') THEN
    CREATE TYPE "EmbeddingSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');
  END IF;
END $$;

-- Track embedding sync state on products
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "embedding_sync_status" "EmbeddingSyncStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "embedding_dirty" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "embedding_content_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "embedding_updated_at" TIMESTAMP(3);

-- Persist product embedding snapshots and vectors
CREATE TABLE IF NOT EXISTS "product_embeddings" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "model_name" TEXT NOT NULL,
  "summary_model" TEXT,
  "embedding_vector" vector,
  "embedding_dim" INTEGER NOT NULL,
  "embedding_input_text" TEXT NOT NULL,
  "summary_text" TEXT,
  "semantic_context" TEXT,
  "content_hash" TEXT NOT NULL,
  "status" "EmbeddingSyncStatus" NOT NULL DEFAULT 'SYNCED',
  "error_message" TEXT,
  "last_embedded_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_embeddings_product_model_unique" UNIQUE ("product_id", "model_name"),
  CONSTRAINT "product_embeddings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "products_embedding_dirty_updated_at_idx"
  ON "products"("embedding_dirty", "updated_at");

CREATE INDEX IF NOT EXISTS "products_embedding_sync_status_idx"
  ON "products"("embedding_sync_status");

CREATE INDEX IF NOT EXISTS "product_embeddings_product_id_is_active_idx"
  ON "product_embeddings"("product_id", "is_active");

CREATE INDEX IF NOT EXISTS "product_embeddings_status_idx"
  ON "product_embeddings"("status");

CREATE INDEX IF NOT EXISTS "product_embeddings_content_hash_idx"
  ON "product_embeddings"("content_hash");

-- NOTE: ivfflat needs ANALYZE and enough data; keep it for future if dimension known.
-- Example:
-- CREATE INDEX "product_embeddings_embedding_vector_idx"
--   ON "product_embeddings" USING ivfflat ("embedding_vector" vector_cosine_ops) WITH (lists = 100);
