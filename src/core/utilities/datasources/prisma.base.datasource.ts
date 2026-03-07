import { PrismaService } from '@core/modules/prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class PrismaDatasource<
  T,
  CreateInput,
  UpdateInput,
  WhereInput,
  WhereUniqueInput,
  OrderByInput
> {
  protected constructor(
    protected readonly prisma: PrismaService,
    private readonly modelDelegate: {
      create: (args: { data: CreateInput }) => Promise<T>;
      findMany: (args?: {
        where?: WhereInput;
        skip?: number;
        take?: number;
        orderBy?: OrderByInput;
      }) => Promise<T[]>;
      findFirst: (args?: { where?: WhereInput }) => Promise<T | null>;
      findUnique: (args: { where: WhereUniqueInput }) => Promise<T | null>;
      update: (args: {
        where: WhereUniqueInput;
        data: UpdateInput;
      }) => Promise<T>;
      updateMany: (args: {
        where: WhereInput;
        data: UpdateInput;
      }) => Promise<{ count: number }>;
      delete: (args: { where: WhereUniqueInput }) => Promise<T>;
      deleteMany: (args: { where: WhereInput }) => Promise<{ count: number }>;
      count: (args?: { where?: WhereInput }) => Promise<number>;
    },
    private readonly softDelete: boolean = false
  ) {}

  private applySoftDeleteFilter(where: WhereInput): WhereInput {
    if (!this.softDelete) return where;
    return { ...where, deletedAt: null } as WhereInput;
  }

  async create(data: CreateInput): Promise<T> {
    return this.modelDelegate.create({ data });
  }

  async findAllByCondition(
    where: WhereInput,
    options?: {
      skip?: number;
      take?: number;
      orderBy?: OrderByInput;
    }
  ): Promise<T[]> {
    return this.modelDelegate.findMany({
      where: this.applySoftDeleteFilter(where),
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy
    });
  }

  async findOneByCondition(where: WhereInput): Promise<T | null> {
    return this.modelDelegate.findFirst({
      where: this.applySoftDeleteFilter(where)
    });
  }

  async findById(id: string): Promise<T | null> {
    if (this.softDelete) {
      return this.modelDelegate.findFirst({
        where: { id, deletedAt: null } as unknown as WhereInput
      });
    }
    return this.modelDelegate.findUnique({
      where: { id } as WhereUniqueInput
    });
  }

  async updateById(id: string, data: UpdateInput): Promise<T> {
    return this.modelDelegate.update({
      where: { id } as WhereUniqueInput,
      data
    });
  }

  async updateOneByCondition(
    where: WhereUniqueInput,
    data: UpdateInput
  ): Promise<T> {
    return this.modelDelegate.update({ where, data });
  }

  async updateManyByCondition(
    where: WhereInput,
    data: UpdateInput
  ): Promise<{ count: number }> {
    return this.modelDelegate.updateMany({ where, data });
  }

  async deleteById(id: string): Promise<T> {
    return this.modelDelegate.delete({
      where: { id } as WhereUniqueInput
    });
  }

  async deleteOneByCondition(where: WhereUniqueInput): Promise<T> {
    return this.modelDelegate.delete({ where });
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
