import { CategoryDatasource } from '@components/categories/datasources/category.datasource';
import { QueryCategoryDto } from '@components/categories/dtos/query-category.dto';
import { CategoryEntity } from '@components/categories/entities/category.entity';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Category, Prisma } from '@prisma/client';

@Injectable()
export class CategoryRepository extends BaseRepository<
  CategoryEntity,
  Category
> {
  constructor(private readonly datasource: CategoryDatasource) {
    super(CategoryEntity);
  }

  async findAll(query: QueryCategoryDto): Promise<PaginatedData<Category>> {
    const { pagination, sort, filter, search } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
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
      where.AND = [...existingAnd, ...nextAnd] as Prisma.CategoryWhereInput[];
    }

    const orderBy: Prisma.CategoryOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.CategoryOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ position: 'asc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.CategoryOrderByWithRelationInput);

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

  async findBySlug(slug: string): Promise<Category | null> {
    return this.datasource.findOneByCondition({
      slug
    } as Prisma.CategoryWhereInput);
  }

  async findById(id: string): Promise<Category | null> {
    return this.datasource.findById(id);
  }

  async findRootCategories(): Promise<Category[]> {
    return this.datasource.findAllByCondition(
      { parentId: null } as Prisma.CategoryWhereInput,
      { orderBy: { position: 'asc' } }
    );
  }

  async findChildrenByParentId(parentId: string): Promise<Category[]> {
    return this.datasource.findAllByCondition(
      { parentId } as Prisma.CategoryWhereInput,
      { orderBy: { position: 'asc' } }
    );
  }

  async createCategory(data: Prisma.CategoryCreateInput): Promise<Category> {
    return this.datasource.create(data);
  }

  async updateCategory(
    id: string,
    data: Prisma.CategoryUpdateInput
  ): Promise<Category> {
    return this.datasource.updateById(id, data);
  }
}
