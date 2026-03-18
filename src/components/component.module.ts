import { AddressModule } from '@components/addresses/addresses.module';
import { AuthModule } from '@components/auth/auth.module';
import { CartsModule } from '@components/carts/carts.module';
import { CategoryModule } from '@components/categories/categories.module';
import { FilesModule } from '@components/files/files.module';
import { OrdersModule } from '@components/orders/orders.module';
import { ProductsModule } from '@components/products/products.module';
import { UserModule } from '@components/users/users.module';
import { VariantsModule } from '@components/variants/variants.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    UserModule,
    AuthModule,
    FilesModule,
    CategoryModule,
    AddressModule,
    CartsModule,
    OrdersModule,
    ProductsModule,
    VariantsModule
  ],
  controllers: [],
  providers: [],
  exports: []
})
export class ComponentModule {}
