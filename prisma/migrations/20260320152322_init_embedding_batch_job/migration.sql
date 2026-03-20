/*
  Warnings:

  - Made the column `embedding_vector` on table `product_embeddings` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BatchJobPhase" AS ENUM ('SUMMARY', 'EMBEDDING');

-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "product_embeddings" ALTER COLUMN "embedding_vector" SET NOT NULL;

-- CreateTable
CREATE TABLE "embedding_batch_jobs" (
    "id" TEXT NOT NULL,
    "phase" "BatchJobPhase" NOT NULL,
    "status" "BatchJobStatus" NOT NULL DEFAULT 'PENDING',
    "gemini_batch_name" TEXT,
    "gemini_file_name" TEXT,
    "product_ids" JSONB NOT NULL,
    "product_count" INTEGER NOT NULL,
    "summary_results" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "embedding_batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "embedding_batch_jobs_status_phase_idx" ON "embedding_batch_jobs"("status", "phase");

-- CreateIndex
CREATE INDEX "embedding_batch_jobs_created_at_idx" ON "embedding_batch_jobs"("created_at");
