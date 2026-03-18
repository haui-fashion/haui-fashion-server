import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

@Injectable()
export class OrderDatasource extends PrismaDatasource<
  Order,
  Prisma.OrderCreateInput,
  Prisma.OrderUpdateInput,
  Prisma.OrderWhereInput,
  Prisma.OrderWhereUniqueInput,
  Prisma.OrderOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.order);
  }
}
