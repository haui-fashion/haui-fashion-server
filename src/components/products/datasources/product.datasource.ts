import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';

@Injectable()
export class ProductDatasource extends PrismaDatasource<
  Product,
  Prisma.ProductCreateInput,
  Prisma.ProductUpdateInput,
  Prisma.ProductWhereInput,
  Prisma.ProductWhereUniqueInput,
  Prisma.ProductOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.product);
  }
}
