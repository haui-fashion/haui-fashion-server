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
import { MAX_PARENT_DEPTH } from '../constants/category.constant';

@Injectable()
export class CategoryRepository extends BaseRepository<
  CategoryEntity,
  Category
> {
  constructor(private readonly datasource: CategoryDatasource) {
    super(CategoryEntity);
  }

  private buildParentInclude(depth: number): Record<string, any> | boolean {
    if (depth <= 0) return true;
    return { include: { parent: this.buildParentInclude(depth - 1) } };
  }

  async findAll(
    query: QueryCategoryDto,
    options?: { includeInactive?: boolean }
  ): Promise<PaginatedData<Category>> {
    const { pagination, sort, filter, search } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (!options?.includeInactive) {
      where.isActive = true;
    }

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
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.CategoryOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      skip,
      take: limit,
      orderBy: finalOrderBy,
      include: {
        parent: this.buildParentInclude(MAX_PARENT_DEPTH)
      }
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

  async findBySlug(
    slug: string,
    options?: { includeInactive?: boolean }
  ): Promise<Category | null> {
    return this.datasource.findOneByCondition({
      slug,
      ...(!options?.includeInactive && { isActive: true })
    } as Prisma.CategoryWhereInput);
  }

  async findById(
    id: string,
    options?: { includeInactive?: boolean }
  ): Promise<Category | null> {
    return this.datasource.findOneByCondition(
      {
        id,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.CategoryWhereInput,
      {
        include: {
          parent: this.buildParentInclude(MAX_PARENT_DEPTH)
        }
      }
    );
  }

  async findRootCategories(options?: {
    includeInactive?: boolean;
  }): Promise<Category[]> {
    return this.datasource.findAllByCondition(
      {
        parentId: null,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.CategoryWhereInput,
      { orderBy: { position: 'asc' } }
    );
  }

  async findChildrenByParentId(
    parentId: string,
    options?: { includeInactive?: boolean }
  ): Promise<Category[]> {
    return this.datasource.findAllByCondition(
      {
        parentId,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.CategoryWhereInput,
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
