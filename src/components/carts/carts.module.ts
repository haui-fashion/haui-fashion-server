import { CartController } from '@components/carts/controllers/cart.controller';
import { CartItemDatasource } from '@components/carts/datasources/cart-item.datasource';
import { CartDatasource } from '@components/carts/datasources/cart.datasource';
import { CartRepository } from '@components/carts/repositories/cart.repository';
import { CartService } from '@components/carts/services/cart.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [CartController],
  providers: [CartDatasource, CartItemDatasource, CartRepository, CartService],
  exports: [CartService]
})
export class CartsModule {}
