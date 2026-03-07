import { CategoryController } from '@components/categories/controllers/category.controller';
import { CategoryDatasource } from '@components/categories/datasources/category.datasource';
import { CategoryRepository } from '@components/categories/repositories/category.repository';
import { CategoryService } from '@components/categories/services/category.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [CategoryController],
  providers: [CategoryDatasource, CategoryRepository, CategoryService],
  exports: [CategoryService]
})
export class CategoryModule {}
