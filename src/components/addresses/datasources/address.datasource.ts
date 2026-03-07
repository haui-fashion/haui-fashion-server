import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';

@Injectable()
export class AddressDatasource extends PrismaDatasource<
  Address,
  Prisma.AddressCreateInput,
  Prisma.AddressUpdateInput,
  Prisma.AddressWhereInput,
  Prisma.AddressWhereUniqueInput,
  Prisma.AddressOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.address, false);
  }
}
