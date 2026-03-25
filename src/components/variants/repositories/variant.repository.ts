import { VariantDatasource } from '@components/variants/datasources/variant.datasource';
import { QueryVariantDto } from '@components/variants/dtos/query-variant.dto';
import { VariantEntity } from '@components/variants/entities/variant.entity';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Prisma, Variant } from '@prisma/client';

type VariantWithProduct = Prisma.VariantGetPayload<{
  include: {
    product: {
      include: {
        images: {
          include: {
            file: true;
            optionValue: true;
          };
          orderBy: {
            position: 'asc';
          };
        };
      };
    };
    colorOptionValue: true;
    sizeOptionValue: true;
  };
}>;

const variantInclude = {
  product: {
    include: {
      images: {
        include: {
          file: true,
          optionValue: true
        },
        orderBy: { position: 'asc' as const }
      }
    }
  },
  colorOptionValue: true,
  sizeOptionValue: true
} as const;

@Injectable()
export class VariantRepository extends BaseRepository<VariantEntity, Variant> {
  constructor(private readonly datasource: VariantDatasource) {
    super(VariantEntity);
  }

  async findAll(
    query: QueryVariantDto,
    options?: { includeInactive?: boolean }
  ): Promise<PaginatedData<Variant>> {
    const { pagination, sort, filter, search, productId } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.VariantWhereInput = {};

    if (!options?.includeInactive) {
      where.product = {
        isActive: true
      };
    }

    if (productId) {
      where.productId = productId;
    }

    if (search) {
      where.OR = [
        { sku: { contains: search, mode: 'insensitive' } },
        {
          sizeOptionValue: {
            is: {
              value: { contains: search, mode: 'insensitive' }
            }
          }
        },
        {
          colorOptionValue: {
            is: {
              value: { contains: search, mode: 'insensitive' }
            }
          }
        }
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
      where.AND = [...existingAnd, ...nextAnd] as Prisma.VariantWhereInput[];
    }

    const orderBy: Prisma.VariantOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.VariantOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.VariantOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      skip,
      take: limit,
      orderBy: finalOrderBy,
      include: variantInclude
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

  async findById(
    id: string,
    options?: { includeInactive?: boolean }
  ): Promise<VariantWithProduct | null> {
    return this.datasource.findOneByCondition(
      {
        id,
        ...(!options?.includeInactive && {
          product: {
            isActive: true
          }
        })
      } as Prisma.VariantWhereInput,
      {
        include: variantInclude
      }
    ) as Promise<VariantWithProduct | null>;
  }

  async findBySku(
    sku: string,
    options?: { includeInactive?: boolean }
  ): Promise<Variant | null> {
    return this.datasource.findOneByCondition({
      sku,
      ...(!options?.includeInactive && {
        product: {
          isActive: true
        }
      })
    } as Prisma.VariantWhereInput);
  }

  async createVariant(
    data: Prisma.VariantCreateInput
  ): Promise<VariantWithProduct> {
    return this.datasource.create(data, {
      include: variantInclude
    }) as Promise<VariantWithProduct>;
  }

  async updateVariant(
    id: string,
    data: Prisma.VariantUpdateInput
  ): Promise<VariantWithProduct> {
    return this.datasource.updateById(id, data, {
      include: variantInclude
    }) as Promise<VariantWithProduct>;
  }

  async deleteVariant(id: string): Promise<Variant> {
    return this.datasource.deleteById(id);
  }
}
