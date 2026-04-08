import { AddressModule } from '@components/addresses/addresses.module';
import { AuthModule } from '@components/auth/auth.module';
import { CartsModule } from '@components/carts/carts.module';
import { CategoryModule } from '@components/categories/categories.module';
import { ChatbotModule } from '@components/chatbot/chatbot.module';
import { FilesModule } from '@components/files/files.module';
import { OrdersModule } from '@components/orders/orders.module';
import { ProductEmbeddingModule } from '@components/product-embedding/product-embedding.module';
import { ProductsModule } from '@components/products/products.module';
import { ReviewsModule } from '@components/reviews/reviews.module';
import { ShippingModule } from '@components/shipping/shipping.module';
import { UserModule } from '@components/users/users.module';
import { VariantsModule } from '@components/variants/variants.module';
import { ReportsModule } from '@components/reports/reports.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    ChatbotModule,
    UserModule,
    AuthModule,
    FilesModule,
    CategoryModule,
    AddressModule,
    CartsModule,
    OrdersModule,
    ProductEmbeddingModule,
    ProductsModule,
    ReviewsModule,
    VariantsModule,
    ShippingModule,
    ReportsModule
  ],
  controllers: [],
  providers: [],
  exports: []
})
export class ComponentModule {}
