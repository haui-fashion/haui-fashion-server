import { StartEmbeddingPipelineOptionsDto } from '@components/product-embedding/dtos/start-embedding-pipeline-options.dto';
import { ProductEmbeddingLocalService } from '@components/product-embedding/services/product-embedding-local.service';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BatchJobOrchestratorService {
  private readonly logger = new Logger(BatchJobOrchestratorService.name);

  constructor(
    private readonly productEmbeddingLocalService: ProductEmbeddingLocalService
  ) {}

  async startEmbeddingPipeline(options: StartEmbeddingPipelineOptionsDto = {}) {
    const result = await this.productEmbeddingLocalService.syncDirtyProducts({
      force: options.force,
      limit: options.limit,
      productId: options.productId,
      batchSize: options.batchSize
    });

    this.logger.log(
      `Local embedding sync finished: processed=${result.processed}, synced=${result.synced}, skipped=${result.skipped}, failed=${result.failed}, batches=${result.batches}`
    );

    return result;
  }
}
