import { UserDatasource } from '@components/users/datasources/user.datasource';
import { QueryUserDto } from '@components/users/dtos/query-user.dto';
import { UserEntity } from '@components/users/entities/user.entity';
import { BaseRepository } from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';

@Injectable()
export class UserRepository extends BaseRepository<UserEntity, User> {
  constructor(private readonly datasource: UserDatasource) {
    super(UserEntity);
  }

  async findAll(query: QueryUserDto): Promise<{ data: User[]; total: number }> {
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
      filter.forEach((f) => {
        (where as Record<string, any>)[f.column] = {
          contains: f.value,
          mode: 'insensitive'
        };
      });
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

    return { data, total };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.datasource.findOneByCondition({
      email
    } as Prisma.UserWhereInput);
  }

  async findById(id: string): Promise<User | null> {
    return this.datasource.findById(id);
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.datasource.create(data);
  }

  async updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.datasource.updateById(id, data);
  }
}
