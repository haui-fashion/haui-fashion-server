import { ProductController } from '@components/products/controllers/product.controller';
import { ProductDatasource } from '@components/products/datasources/product.datasource';
import { ProductRepository } from '@components/products/repositories/product.repository';
import { ProductService } from '@components/products/services/product.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [ProductController],
  providers: [ProductDatasource, ProductRepository, ProductService],
  exports: [ProductService]
})
export class ProductsModule {}
