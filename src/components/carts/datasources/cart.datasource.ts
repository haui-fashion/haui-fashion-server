import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Cart, Prisma } from '@prisma/client';

@Injectable()
export class CartDatasource extends PrismaDatasource<
  Cart,
  Prisma.CartCreateInput,
  Prisma.CartUpdateInput,
  Prisma.CartWhereInput,
  Prisma.CartWhereUniqueInput,
  Prisma.CartOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.cart);
  }
}
