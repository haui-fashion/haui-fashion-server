import { VNPayService } from '@core/modules/vnpay/vnpay.service';
import { Module } from '@nestjs/common';

@Module({
  providers: [VNPayService],
  exports: [VNPayService]
})
export class VNPayModule {}
