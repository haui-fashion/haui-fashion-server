import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { CartItem, Prisma } from '@prisma/client';

@Injectable()
export class CartItemDatasource extends PrismaDatasource<
  CartItem,
  Prisma.CartItemCreateInput,
  Prisma.CartItemUpdateInput,
  Prisma.CartItemWhereInput,
  Prisma.CartItemWhereUniqueInput,
  Prisma.CartItemOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.cartItem);
  }
}
