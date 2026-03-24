import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BatchJobOrchestratorService } from './batch-job-orchestrator.service';

@Injectable()
export class ProductEmbeddingSchedulerService {
  private readonly logger = new Logger(ProductEmbeddingSchedulerService.name);

  constructor(
    private readonly orchestratorService: BatchJobOrchestratorService
  ) {}

  @Cron('0 0 * * *', {
    timeZone: process.env.APP_TIMEZONE || 'Asia/Ho_Chi_Minh'
  })
  async startEmbeddingPipeline() {
    this.logger.log('Run scheduled product embedding pipeline at midnight');
    await this.orchestratorService.startEmbeddingPipeline();
  }
}
