import { PrismaService } from '@core/modules/prisma';
import { PrismaDatasource } from '@core/utilities/datasources';
import { Injectable } from '@nestjs/common';
import { Prisma, Review } from '@prisma/client';

@Injectable()
export class ReviewDatasource extends PrismaDatasource<
  Review,
  Prisma.ReviewCreateInput,
  Prisma.ReviewUpdateInput,
  Prisma.ReviewWhereInput,
  Prisma.ReviewWhereUniqueInput,
  Prisma.ReviewOrderByWithRelationInput
> {
  constructor(prisma: PrismaService) {
    super(prisma, prisma.review);
  }
}
