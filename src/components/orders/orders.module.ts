import { OrderController } from '@components/orders/controllers/order.controller';
import { OrderDatasource } from '@components/orders/datasources/order.datasource';
import { OrderRepository } from '@components/orders/repositories/order.repository';
import { OrderService } from '@components/orders/services/order.service';
import { ShippingModule } from '@components/shipping/shipping.module';
import { VNPayModule } from '@core/modules/vnpay';
import { MoMoModule } from '@core/modules/momo';
import { Module } from '@nestjs/common';

@Module({
  imports: [ShippingModule, VNPayModule, MoMoModule],
  controllers: [OrderController],
  providers: [OrderDatasource, OrderRepository, OrderService],
  exports: [OrderService]
})
export class OrdersModule {}
