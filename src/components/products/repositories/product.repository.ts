import { ProductDatasource } from '@components/products/datasources/product.datasource';
import { QueryProductDto } from '@components/products/dtos/query-product.dto';
import { ProductEntity } from '@components/products/entities/product.entity';
import { PrismaService } from '@core/modules/prisma';
import { PaginatedData } from '@core/utilities/interceptors';
import {
  BaseRepository,
  buildPrismaWhereFromFilters
} from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    images: {
      include: {
        file: true;
      };
      orderBy: {
        position: 'asc';
      };
    };
    variants: {
      orderBy: {
        createdAt: 'desc';
      };
    };
  };
}>;

type ProductImageSyncInput = {
  fileId: string;
  isPrimary: boolean;
  position: number;
};

const productInclude = {
  category: true,
  images: {
    include: {
      file: true
    },
    orderBy: {
      position: 'asc'
    }
  },
  variants: {
    orderBy: {
      createdAt: 'desc'
    }
  }
} as const;

@Injectable()
export class ProductRepository extends BaseRepository<ProductEntity, Product> {
  constructor(
    private readonly datasource: ProductDatasource,
    private readonly prisma: PrismaService
  ) {
    super(ProductEntity);
  }

  async findAll(
    query: QueryProductDto,
    options?: { includeInactive?: boolean }
  ): Promise<PaginatedData<Product>> {
    const { pagination, sort, filter, search } = query;
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (!options?.includeInactive) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { descriptionHtml: { contains: search, mode: 'insensitive' } }
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
      where.AND = [...existingAnd, ...nextAnd] as Prisma.ProductWhereInput[];
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [];
    if (sort && sort.length > 0) {
      sort.forEach((s) => {
        const orderItem: Record<string, 'asc' | 'desc'> = {};
        orderItem[s.column] = s.value;
        orderBy.push(orderItem as Prisma.ProductOrderByWithRelationInput);
      });
    } else {
      orderBy.push({ createdAt: 'desc' });
    }

    const finalOrderBy =
      orderBy.length === 1
        ? orderBy[0]
        : (orderBy as unknown as Prisma.ProductOrderByWithRelationInput);

    const dataPromise = this.datasource.findAllByCondition(where, {
      skip,
      take: limit,
      orderBy: finalOrderBy,
      include: productInclude
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
  ): Promise<ProductWithRelations | null> {
    return this.datasource.findOneByCondition(
      {
        id,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.ProductWhereInput,
      {
        include: productInclude
      }
    ) as Promise<ProductWithRelations | null>;
  }

  async findBySlug(
    slug: string,
    options?: { includeInactive?: boolean }
  ): Promise<ProductWithRelations | null> {
    return this.datasource.findOneByCondition(
      {
        slug,
        ...(!options?.includeInactive && { isActive: true })
      } as Prisma.ProductWhereInput,
      {
        include: productInclude
      }
    ) as Promise<ProductWithRelations | null>;
  }

  async createProduct(
    data: Prisma.ProductCreateInput
  ): Promise<ProductWithRelations> {
    return this.datasource.create(data, {
      include: productInclude
    }) as Promise<ProductWithRelations>;
  }

  async updateProduct(
    id: string,
    data: Prisma.ProductUpdateInput
  ): Promise<ProductWithRelations> {
    return this.datasource.updateById(id, data, {
      include: productInclude
    }) as Promise<ProductWithRelations>;
  }

  async deleteProduct(id: string): Promise<Product> {
    return this.datasource.deleteById(id);
  }

  async findExistingFileIds(fileIds: string[]): Promise<string[]> {
    if (fileIds.length === 0) {
      return [];
    }

    const files = await this.prisma.file.findMany({
      where: {
        id: { in: fileIds }
      },
      select: {
        id: true
      }
    });

    return files.map((file) => file.id);
  }

  async replaceImages(
    productId: string,
    images: ProductImageSyncInput[]
  ): Promise<ProductWithRelations> {
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({
        where: { productId }
      });

      if (images.length > 0) {
        await tx.productImage.createMany({
          data: images.map((image) => ({
            productId,
            fileId: image.fileId,
            isPrimary: image.isPrimary,
            position: image.position
          }))
        });
      }
    });

    return this.findById(productId, {
      includeInactive: true
    }) as Promise<ProductWithRelations>;
  }
}
