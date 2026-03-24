import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from '@core/modules/embedding/services/embedding.service';
import { HttpClientModule } from '@core/modules/http-client/http-client.module';

@Global()
@Module({
  imports: [HttpClientModule],
  providers: [EmbeddingService],
  exports: [EmbeddingService]
})
export class EmbeddingModule {}
