import { ReviewDatasource } from '@components/reviews/datasources/review.datasource';
import { QueryReviewDto } from '@components/reviews/dtos/query-review.dto';
import { ReviewRecordEntity } from '@components/reviews/entities/review-record.entity';
import { ReviewEntity } from '@components/reviews/entities/review.entity';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const reviewInclude = {
  user: {
    select: {
      fullname: true
    }
  },
  product: {
    select: {
      id: true,
      slug: true,
      name: true
    }
  },
  image: true
} as const;

@Injectable()
export class ReviewRepository extends BaseRepository<
  ReviewEntity,
  ReviewRecordEntity
> {
  constructor(private readonly datasource: ReviewDatasource) {
    super(ReviewEntity);
  }

  async findAll(
    query: QueryReviewDto
  ): Promise<PaginatedData<ReviewRecordEntity>> {
    const { pagination, sort, filter, search, productId, userId } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ReviewWhereInput = {};

    if (productId) {
      where.productId = productId;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.content = {
        contains: search,
        mode: 'insensitive'
      };
    }

    if (filter && filter.length > 0) {
      const filterWhere = buildPrismaWhereFromFilters(filter);
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      const nextAnd = Array.isArray(filterWhere.AND) ? filterWhere.AND : [];
      where.AND = [...existingAnd, ...nextAnd] as Prisma.ReviewWhereInput[];
    }

    const orderBy: Prisma.ReviewOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.ReviewOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.ReviewOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      skip,
      take: limit,
      orderBy: finalOrderBy,
      include: reviewInclude
    });
    const countPromise = this.datasource.count(where);

    const [data, total] = await Promise.all([dataPromise, countPromise]);

    return {
      items: data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findById(id: string): Promise<ReviewRecordEntity | null> {
    return this.datasource.findById(id, {
      include: reviewInclude
    }) as Promise<ReviewRecordEntity | null>;
  }

  async findByUserAndProduct(
    userId: string,
    productId: string
  ): Promise<ReviewRecordEntity | null> {
    return this.datasource.findOneByCondition({
      userId,
      productId
    } as Prisma.ReviewWhereInput) as Promise<ReviewRecordEntity | null>;
  }

  async createReview(
    data: Prisma.ReviewCreateInput
  ): Promise<ReviewRecordEntity> {
    return this.datasource.create(data, {
      include: reviewInclude
    }) as Promise<ReviewRecordEntity>;
  }

  async updateReview(
    id: string,
    data: Prisma.ReviewUpdateInput
  ): Promise<ReviewRecordEntity> {
    return this.datasource.updateById(id, data, {
      include: reviewInclude
    }) as Promise<ReviewRecordEntity>;
  }

  async deleteReview(id: string): Promise<ReviewRecordEntity> {
    return this.datasource.deleteById(id, {
      include: reviewInclude
    }) as Promise<ReviewRecordEntity>;
  }
}
