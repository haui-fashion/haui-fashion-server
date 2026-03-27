import { ProductController } from '@components/products/controllers/product.controller';
import { ProductDatasource } from '@components/products/datasources/product.datasource';
import { ProductRepository } from '@components/products/repositories/product.repository';
import { ProductDescriptionGenerationService } from '@components/products/services/product-description-generation.service';
import { ProductService } from '@components/products/services/product.service';
import { VirtualTryOnService } from '@components/products/services/virtual-try-on.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ProductController],
  providers: [
    ProductDatasource,
    ProductRepository,
    ProductDescriptionGenerationService,
    ProductService,
    VirtualTryOnService
  ],
  exports: [ProductService]
})
export class ProductsModule {}
