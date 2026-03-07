import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';

@Injectable()
export class CategoryDatasource extends PrismaDatasource<
  Category,
  Prisma.CategoryCreateInput,
  Prisma.CategoryUpdateInput,
  Prisma.CategoryWhereInput,
  Prisma.CategoryWhereUniqueInput,
  Prisma.CategoryOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.category, true);
  }
}
