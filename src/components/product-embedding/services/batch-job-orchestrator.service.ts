import { ProductSummary } from '@components/product-embedding/entities/product-summary.entity';
import { ProductEmbeddingService } from '@components/product-embedding/services/product-embedding.service';
import { GeminiBatchService } from '@core/modules/gemini/services/gemini-batch.service';
import { PrismaService } from '@core/modules/prisma';
import { JobState } from '@google/genai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BatchJobPhase,
  BatchJobStatus,
  EmbeddingBatchJob
} from '@prisma/client';

@Injectable()
export class BatchJobOrchestratorService {
  private readonly logger = new Logger(BatchJobOrchestratorService.name);
  private readonly generationModel: string;
  private readonly embeddingModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly geminiBatchService: GeminiBatchService,
    private readonly productEmbeddingService: ProductEmbeddingService
  ) {
    this.generationModel =
      this.configService.get<string>('gemini.models.generation') ||
      'gemini-2.5-flash';

    this.embeddingModel =
      this.configService.get<string>('gemini.models.embedding') ||
      'gemini-embedding-001';
  }

  async startPipeline(
    options: { force?: boolean; limit?: number; productId?: string } = {}
  ): Promise<EmbeddingBatchJob | null> {
    const { force = false, limit = 500, productId } = options;

    const whereClause: any = {};
    if (productId) {
      whereClause.id = productId;
    } else if (!force) {
      whereClause.embeddingDirty = true;
    }

    const products = await this.prisma.product.findMany({
      where: whereClause,
      take: limit,
      select: { id: true }
    });

    if (products.length === 0) {
      this.logger.log('No dirty products found for embedding pipeline.');
      return null;
    }

    const productIds = products.map((p) => p.id);
    this.logger.log(
      `Starting embedding pipeline for ${productIds.length} products (Phase 1: Summary)`
    );

    const batchJob = await this.prisma.embeddingBatchJob.create({
      data: {
        phase: BatchJobPhase.SUMMARY,
        status: BatchJobStatus.PENDING,
        productIds: productIds,
        productCount: productIds.length,
        startedAt: new Date()
      }
    });

    try {
      const productsForEmbedding =
        await this.productEmbeddingService.getProductsForEmbedding(productIds);

      const jsonlLines =
        this.productEmbeddingService.buildSummaryJsonlLines(
          productsForEmbedding
        );
      const fileRef = await this.geminiBatchService.uploadJsonlFile(
        jsonlLines,
        `Phase1_Summary_${batchJob.id}`
      );

      const geminiJob = await this.geminiBatchService.createGenerationBatchJob(
        this.generationModel,
        fileRef,
        `Summary Generation Job for ${productIds.length} products`
      );

      return await this.prisma.embeddingBatchJob.update({
        where: { id: batchJob.id },
        data: {
          status: BatchJobStatus.RUNNING,
          geminiBatchName: geminiJob.name,
          geminiFileName: fileRef
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed to start Phase 1 pipeline: ${error.message}`,
        error.stack
      );

      await this.prisma.embeddingBatchJob.update({
        where: { id: batchJob.id },
        data: {
          status: BatchJobStatus.FAILED,
          errorMessage: error.message,
          completedAt: new Date()
        }
      });

      await this.productEmbeddingService.markFailed(productIds, error.message);
      throw error;
    }
  }

  async checkAndAdvance() {
    const activeJobs = await this.prisma.embeddingBatchJob.findMany({
      where: {
        status: { in: [BatchJobStatus.PENDING, BatchJobStatus.RUNNING] }
      }
    });

    if (activeJobs.length === 0) {
      return;
    }

    this.logger.debug(`Found ${activeJobs.length} active batch jobs to check.`);

    for (const job of activeJobs) {
      if (!job.geminiBatchName) continue;

      try {
        const geminiJob = await this.geminiBatchService.getBatchJob(
          job.geminiBatchName
        );

        if (this.geminiBatchService.isTerminalState(geminiJob.state)) {
          this.logger.log(
            `Job ${job.id} (${job.phase}) completed with state: ${geminiJob.state}`
          );

          if (geminiJob.state === JobState.JOB_STATE_SUCCEEDED) {
            if (job.phase === BatchJobPhase.SUMMARY) {
              await this.handleSummarySuccess(job, geminiJob.dest?.fileName);
            } else if (job.phase === BatchJobPhase.EMBEDDING) {
              await this.handleEmbeddingSuccess(job, geminiJob.dest?.fileName);
            }
          } else {
            await this.handleJobFailure(
              job,
              `Job ended in state: ${geminiJob.state}`
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Error checking job ${job.id}: ${error.message}`,
          error.stack
        );
      }
    }
  }

  private async handleSummarySuccess(
    job: EmbeddingBatchJob,
    outputUri: string | undefined
  ) {
    if (!outputUri) {
      await this.handleJobFailure(
        job,
        'Phase 1 Succeeded but no outputUri found'
      );
      return;
    }

    try {
      this.logger.log(`Parsing Phase 1 outputs for job ${job.id}`);
      const rawContent =
        await this.geminiBatchService.downloadResultFile(outputUri);

      const lines = rawContent.split('\\n').filter((l) => l.trim().length > 0);
      const summariesMap = new Map<string, ProductSummary>();

      for (const line of lines) {
        const item = JSON.parse(line);
        const productId = item.request?.key || item.key;

        if (item.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
          const rawText = item.response.candidates[0].content.parts[0].text;
          const cleanJson = rawText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();
          try {
            const summaryData = JSON.parse(cleanJson);
            summariesMap.set(productId, summaryData as ProductSummary);
          } catch (e) {
            this.logger.warn(
              `Failed to parse summary JSON for product ${productId}: ${e.message}`
            );
          }
        }
      }

      const productIds = job.productIds as string[];

      if (summariesMap.size === 0) {
        throw new Error('No valid summaries extracted from the batch response');
      }

      this.logger.log(
        `Extracted ${summariesMap.size}/${productIds.length} valid summaries. Starting Phase 2 (Embedding)`
      );

      await this.prisma.embeddingBatchJob.update({
        where: { id: job.id },
        data: {
          status: BatchJobStatus.SUCCEEDED,
          completedAt: new Date(),
          summaryResults: Object.fromEntries(summariesMap) as any
        }
      });

      const phase2Job = await this.prisma.embeddingBatchJob.create({
        data: {
          phase: BatchJobPhase.EMBEDDING,
          status: BatchJobStatus.PENDING,
          productIds: job.productIds as any,
          productCount: job.productCount,
          startedAt: new Date()
        }
      });

      const productsForEmbedding =
        await this.productEmbeddingService.getProductsForEmbedding(productIds);
      const jsonlLines = this.productEmbeddingService.buildEmbeddingJsonlLines(
        productsForEmbedding,
        summariesMap
      );

      const fileRef = await this.geminiBatchService.uploadJsonlFile(
        jsonlLines,
        `Phase2_Embeddings_${phase2Job.id}`
      );

      const geminiJob = await this.geminiBatchService.createEmbeddingBatchJob(
        this.embeddingModel,
        fileRef,
        `Embedding Job for ${productIds.length} products`
      );

      await this.prisma.embeddingBatchJob.update({
        where: { id: phase2Job.id },
        data: {
          status: BatchJobStatus.RUNNING,
          geminiBatchName: geminiJob.name,
          geminiFileName: fileRef
        }
      });
    } catch (error) {
      this.logger.error(
        `Failed handling Phase 1 success for job ${job.id}: ${error.message}`,
        error.stack
      );
      await this.handleJobFailure(job, error.message);
    }
  }

  private async handleEmbeddingSuccess(
    job: EmbeddingBatchJob,
    outputUri: string | undefined
  ) {
    if (!outputUri) {
      await this.handleJobFailure(
        job,
        'Phase 2 Succeeded but no outputUri found'
      );
      return;
    }

    try {
      this.logger.log(`Parsing Phase 2 outputs for job ${job.id}`);
      const rawContent =
        await this.geminiBatchService.downloadResultFile(outputUri);

      const lines = rawContent.split('\\n').filter((l) => l.trim().length > 0);
      const embeddingsMap = new Map<string, number[]>();

      for (const line of lines) {
        const item = JSON.parse(line);
        const productId = item.request?.key || item.key;

        if (item.response?.embeddings?.[0]?.values) {
          embeddingsMap.set(productId, item.response.embeddings[0].values);
        }
      }

      const productIds = job.productIds as string[];

      const phase1Job = await this.prisma.embeddingBatchJob.findFirst({
        where: {
          phase: BatchJobPhase.SUMMARY,
          status: BatchJobStatus.SUCCEEDED,
          id: { not: job.id }
        },
        orderBy: { completedAt: 'desc' }
      });

      const summariesObj = (phase1Job?.summaryResults || {}) as Record<
        string,
        any
      >;
      const summariesMap = new Map<string, ProductSummary>(
        Object.entries(summariesObj)
      );

      this.logger.log(
        `Extracted ${embeddingsMap.size}/${productIds.length} embeddings. Persisting to DB...`
      );

      await this.productEmbeddingService.persistBatchResults(
        productIds,
        summariesMap,
        embeddingsMap
      );

      await this.prisma.embeddingBatchJob.update({
        where: { id: job.id },
        data: {
          status: BatchJobStatus.SUCCEEDED,
          completedAt: new Date()
        }
      });

      this.logger.log(
        `Successfully completed Phase 2 for job ${job.id}. Pipeline done.`
      );
    } catch (error) {
      this.logger.error(
        `Failed handling Phase 2 success for job ${job.id}: ${error.message}`,
        error.stack
      );
      await this.handleJobFailure(job, error.message);
    }
  }

  private async handleJobFailure(job: EmbeddingBatchJob, message: string) {
    await this.prisma.embeddingBatchJob.update({
      where: { id: job.id },
      data: {
        status: BatchJobStatus.FAILED,
        errorMessage: message,
        completedAt: new Date()
      }
    });

    const productIds = job.productIds as string[];
    await this.productEmbeddingService.markFailed(productIds, message);
  }
}
