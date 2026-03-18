import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Prisma, Variant } from '@prisma/client';

@Injectable()
export class VariantDatasource extends PrismaDatasource<
  Variant,
  Prisma.VariantCreateInput,
  Prisma.VariantUpdateInput,
  Prisma.VariantWhereInput,
  Prisma.VariantWhereUniqueInput,
  Prisma.VariantOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.variant);
  }
}
