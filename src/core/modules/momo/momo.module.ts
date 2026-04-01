import { MoMoService } from '@core/modules/momo/momo.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [MoMoService],
  exports: [MoMoService]
})
export class MoMoModule {}
