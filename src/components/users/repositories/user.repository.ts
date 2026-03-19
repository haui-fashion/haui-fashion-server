import { MAX_CODE_GENERATION_RETRIES } from '@components/orders/constants/order.constant';
import { USER_CODE_OPTIONS } from '@components/users/constants/user.constant';
import { UserDatasource } from '@components/users/datasources/user.datasource';
import { QueryUserDto } from '@components/users/dtos/query-user.dto';
import { UserEntity } from '@components/users/entities/user.entity';
import { EntityCodeService } from '@core/modules/prisma';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UserRepository extends BaseRepository<UserEntity, User> {
  constructor(
    private readonly datasource: UserDatasource,
    private readonly entityCodeService: EntityCodeService
  ) {
    super(UserEntity);
  }

  async findAll(query: QueryUserDto): Promise<PaginatedData<User>> {
    const { pagination, sort, filter, search } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { fullname: { contains: search, mode: 'insensitive' } }
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
      where.AND = [...existingAnd, ...nextAnd] as Prisma.UserWhereInput[];
    }

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.UserOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.UserOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      skip,
      take: limit,
      orderBy: finalOrderBy
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

  async findByEmail(email: string): Promise<User | null> {
    return this.datasource.findOneByCondition({
      email
    } as Prisma.UserWhereInput);
  }

  async findById(id: string): Promise<User | null> {
    return this.datasource.findById(id, {
      include: {
        addresses: true
      }
    });
  }

  async createUser(data: Omit<Prisma.UserCreateInput, 'code'>): Promise<User> {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_RETRIES; attempt++) {
      const nextCode = await this.entityCodeService.nextCode(USER_CODE_OPTIONS);

      try {
        return await this.datasource.create({
          ...data,
          code: nextCode
        });
      } catch (error) {
        if (!this.isCodeConflictError(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException(
      'Không thể tạo mã người dùng tự động. Vui lòng thử lại.'
    );
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.datasource.updateById(id, data);
  }

  private isCodeConflictError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.includes('code');
    }

    return typeof target === 'string' ? target.includes('code') : false;
  }
}
