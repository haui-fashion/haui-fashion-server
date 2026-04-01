import { ShippingController } from '@components/shipping/controllers/shipping.controller';
import { ShippingService } from '@components/shipping/services/shipping.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ShippingController],
  providers: [ShippingService],
  exports: [ShippingService]
})
export class ShippingModule {}
