import { BatchJobOrchestratorService } from '@components/product-embedding/services/batch-job-orchestrator.service';
import { ProductEmbeddingSchedulerService } from '@components/product-embedding/services/product-embedding-scheduler.service';
import { ProductEmbeddingSummaryService } from '@components/product-embedding/services/product-embedding-summary.service';
import { ProductEmbeddingService } from '@components/product-embedding/services/product-embedding.service';
import { GeminiModule } from '@core/modules/gemini';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [GeminiModule],
  providers: [
    ProductEmbeddingSummaryService,
    ProductEmbeddingService,
    BatchJobOrchestratorService,
    ProductEmbeddingSchedulerService
  ],
  exports: [BatchJobOrchestratorService, ProductEmbeddingService]
})
export class ProductEmbeddingModule {}
