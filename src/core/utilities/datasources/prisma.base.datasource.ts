import { PrismaService } from '@core/modules/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class PrismaDatasource<
  T,
  CreateInput,
  UpdateInput,
  WhereInput,
  WhereUniqueInput,
  OrderByInput,
  IncludeInput = any,
  SelectInput = any,
  DistinctInput = any,
  CursorInput = any
> {
  protected constructor(
    protected readonly prisma: PrismaService,
    private readonly modelDelegate: {
      create: (args: {
        data: CreateInput;
        include?: IncludeInput;
        select?: SelectInput;
      }) => Promise<T>;
      findMany: (args?: {
        where?: WhereInput;
        skip?: number;
        take?: number;
        orderBy?: OrderByInput;
        include?: IncludeInput;
        select?: SelectInput;
        distinct?: DistinctInput;
        cursor?: CursorInput;
      }) => Promise<T[]>;
      findFirst: (args?: {
        where?: WhereInput;
        include?: IncludeInput;
        select?: SelectInput;
        distinct?: DistinctInput;
        cursor?: CursorInput;
        orderBy?: OrderByInput;
      }) => Promise<T | null>;
      findUnique: (args: {
        where: WhereUniqueInput;
        include?: IncludeInput;
        select?: SelectInput;
      }) => Promise<T | null>;
      update: (args: {
        where: WhereUniqueInput;
        data: UpdateInput;
        include?: IncludeInput;
        select?: SelectInput;
      }) => Promise<T>;
      updateMany: (args: {
        where: WhereInput;
        data: UpdateInput;
      }) => Promise<{ count: number }>;
      delete: (args: {
        where: WhereUniqueInput;
        include?: IncludeInput;
        select?: SelectInput;
      }) => Promise<T>;
      deleteMany: (args: { where: WhereInput }) => Promise<{ count: number }>;
      count: (args?: { where?: WhereInput }) => Promise<number>;
    },
    private readonly softDelete: boolean = false
  ) {}

  private applySoftDeleteFilter(where: WhereInput): WhereInput {
    if (!this.softDelete) return where;
    return { ...where, deletedAt: null } as WhereInput;
  }

  async create(
    data: CreateInput,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
    }
  ): Promise<T> {
    return this.modelDelegate.create({
      data,
      include: options?.include,
      select: options?.select
    });
  }

  async findAllByCondition(
    where: WhereInput,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: OrderByInput;
      include?: IncludeInput;
      select?: SelectInput;
      distinct?: DistinctInput;
      cursor?: CursorInput;
    }
  ): Promise<T[]> {
    return this.modelDelegate.findMany({
      where: this.applySoftDeleteFilter(where),
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
      include: options?.include,
      select: options?.select,
      distinct: options?.distinct,
      cursor: options?.cursor
    });
  }

  async findOneByCondition(
    where: WhereInput,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
      distinct?: DistinctInput;
      cursor?: CursorInput;
      orderBy?: OrderByInput;
    }
  ): Promise<T | null> {
    return this.modelDelegate.findFirst({
      where: this.applySoftDeleteFilter(where),
      include: options?.include,
      select: options?.select,
      distinct: options?.distinct,
      cursor: options?.cursor,
      orderBy: options?.orderBy
    });
  }

  async findById(
    id: string,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
    }
  ): Promise<T | null> {
    if (this.softDelete) {
      return this.modelDelegate.findFirst({
        where: { id, deletedAt: null } as unknown as WhereInput,
        include: options?.include,
        select: options?.select
      });
    }
    return this.modelDelegate.findUnique({
      where: { id } as WhereUniqueInput,
      include: options?.include,
      select: options?.select
    });
  }

  async updateById(
    id: string,
    data: UpdateInput,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
    }
  ): Promise<T> {
    return this.modelDelegate.update({
      where: { id } as WhereUniqueInput,
      data,
      include: options?.include,
      select: options?.select
    });
  }

  async updateOneByCondition(
    where: WhereUniqueInput,
    data: UpdateInput,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
    }
  ): Promise<T> {
    return this.modelDelegate.update({
      where,
      data,
      include: options?.include,
      select: options?.select
    });
  }

  async updateManyByCondition(
    where: WhereInput,
    data: UpdateInput
  ): Promise<{ count: number }> {
    return this.modelDelegate.updateMany({ where, data });
  }

  async deleteById(
    id: string,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
    }
  ): Promise<T> {
    return this.modelDelegate.delete({
      where: { id } as WhereUniqueInput,
      include: options?.include,
      select: options?.select
    });
  }

  async deleteOneByCondition(
    where: WhereUniqueInput,
    options?: {
      include?: IncludeInput;
      select?: SelectInput;
    }
  ): Promise<T> {
    return this.modelDelegate.delete({
      where,
      include: options?.include,
      select: options?.select
    });
  }

  async deleteManyByCondition(where: WhereInput): Promise<{ count: number }> {
    return this.modelDelegate.deleteMany({ where });
  }

  async count(where?: WhereInput): Promise<number> {
    const finalWhere = where
      ? this.applySoftDeleteFilter(where)
      : this.softDelete
        ? ({ deletedAt: null } as unknown as WhereInput)
        : undefined;
    return this.modelDelegate.count({ where: finalWhere });
  }

  async exists(where: WhereInput): Promise<boolean> {
    const result = await this.modelDelegate.count({
      where: this.applySoftDeleteFilter(where)
    });
    return result > 0;
  }
}
