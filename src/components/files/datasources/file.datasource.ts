import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources/prisma.base.datasource';
import { Injectable } from '@nestjs/common';
import { File, Prisma } from '@prisma/client';

@Injectable()
export class FileDatasource extends PrismaDatasource<
  File,
  Prisma.FileCreateInput,
  Prisma.FileUpdateInput,
  Prisma.FileWhereInput,
  Prisma.FileWhereUniqueInput,
  Prisma.FileOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.file);
  }
}
