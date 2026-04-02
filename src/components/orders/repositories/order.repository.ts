import { OrderDatasource } from '@components/orders/datasources/order.datasource';
import { QueryOrderDto } from '@components/orders/dtos/query-order.dto';
import { OrderEntity } from '@components/orders/entities/order.entity';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

const orderInclude = Prisma.validator<Prisma.OrderInclude>()({
  user: {
    select: {
      id: true,
      code: true,
      fullname: true,
      email: true
    }
  },
  items: {
    include: {
      variant: {
        include: {
          product: true
        }
      }
    }
  },
  payment: true
});

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: typeof orderInclude;
}>;

@Injectable()
export class OrderRepository extends BaseRepository<OrderEntity, Order> {
  constructor(private readonly datasource: OrderDatasource) {
    super(OrderEntity);
  }

  async findAllForAdmin(
    query: QueryOrderDto
  ): Promise<PaginatedData<OrderWithDetails>> {
    const { pagination, sort, filter, search, status, userId } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { user: { fullname: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (filter && filter.length > 0) {
      const filterWhere = buildPrismaWhereFromFilters(filter);
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      const nextAnd = Array.isArray(filterWhere.AND) ? filterWhere.AND : [];
      where.AND = [...existingAnd, ...nextAnd] as Prisma.OrderWhereInput[];
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.OrderOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.OrderOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      include: orderInclude,
      skip,
      take: limit,
      orderBy: finalOrderBy
    });
    const countPromise = this.datasource.count(where);

    const [items, total] = await Promise.all([dataPromise, countPromise]);

    return {
      items: items as OrderWithDetails[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findByUserId(userId: string): Promise<OrderWithDetails[]> {
    return this.datasource.findAllByCondition(
      { userId } as Prisma.OrderWhereInput,
      {
        include: orderInclude,
        orderBy: {
          createdAt: 'desc'
        }
      }
    ) as Promise<OrderWithDetails[]>;
  }

  async findAllByUser(
    userId: string,
    query: QueryOrderDto
  ): Promise<PaginatedData<OrderWithDetails>> {
    const { pagination, sort, filter, search, status } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [{ code: { contains: search, mode: 'insensitive' } }];
    }

    if (filter && filter.length > 0) {
      const filterWhere = buildPrismaWhereFromFilters(filter);
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];
      const nextAnd = Array.isArray(filterWhere.AND) ? filterWhere.AND : [];
      where.AND = [...existingAnd, ...nextAnd] as Prisma.OrderWhereInput[];
    }

    const orderBy: Prisma.OrderOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.OrderOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.OrderOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      include: orderInclude,
      skip,
      take: limit,
      orderBy: finalOrderBy
    });
    const countPromise = this.datasource.count(where);

    const [items, total] = await Promise.all([dataPromise, countPromise]);

    return {
      items: items as OrderWithDetails[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOneByIdAndUserId(
    id: string,
    userId: string
  ): Promise<OrderWithDetails | null> {
    return this.datasource.findOneByCondition(
      {
        id,
        userId
      } as Prisma.OrderWhereInput,
      {
        include: orderInclude
      }
    ) as Promise<OrderWithDetails | null>;
  }

  async findOneById(id: string): Promise<OrderWithDetails | null> {
    return this.datasource.findOneByCondition(
      { id } as Prisma.OrderWhereInput,
      {
        include: orderInclude
      }
    ) as Promise<OrderWithDetails | null>;
  }
}
