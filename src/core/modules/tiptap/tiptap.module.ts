import { TiptapService } from '@core/modules/tiptap/services/tiptap.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [TiptapService],
  exports: [TiptapService]
})
export class TiptapModule {}
