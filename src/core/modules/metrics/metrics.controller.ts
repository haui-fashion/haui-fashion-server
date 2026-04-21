import { Public } from '@core/utilities/decorators/public.decorator';
import { SkipTransformResponse } from '@core/utilities/interceptors/transform-response.interceptor';
import {
  Controller,
  Get,
  Header,
  VERSION_NEUTRAL,
  Version
} from '@nestjs/common';
import { METRICS_CONTENT_TYPE } from './metrics.constants';
import { MetricsService } from './metrics.service';

@Public()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Version(VERSION_NEUTRAL)
  @Header('Content-Type', METRICS_CONTENT_TYPE)
  @SkipTransformResponse()
  async getMetrics(): Promise<string> {
    return this.metricsService.getMetrics();
  }
}
