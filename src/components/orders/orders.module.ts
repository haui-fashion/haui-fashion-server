import { OrderController } from '@components/orders/controllers/order.controller';
import { OrderDatasource } from '@components/orders/datasources/order.datasource';
import { OrderRepository } from '@components/orders/repositories/order.repository';
import { OrderService } from '@components/orders/services/order.service';
import { ShippingModule } from '@components/shipping/shipping.module';
import { SePayModule } from '@core/modules/sepay';
import { VNPayModule } from '@core/modules/vnpay';
import { Module } from '@nestjs/common';

@Module({
  imports: [ShippingModule, VNPayModule, SePayModule],
  controllers: [OrderController],
  providers: [OrderDatasource, OrderRepository, OrderService],
  exports: [OrderService]
})
export class OrdersModule {}
