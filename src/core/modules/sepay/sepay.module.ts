import { SePayService } from '@core/modules/sepay/sepay.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [SePayService],
  exports: [SePayService]
})
export class SePayModule {}
