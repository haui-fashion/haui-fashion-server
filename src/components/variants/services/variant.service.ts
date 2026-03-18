import { CreateVariantDto } from '@components/variants/dtos/create-variant.dto';
import { QueryVariantDto } from '@components/variants/dtos/query-variant.dto';
import { UpdateVariantDto } from '@components/variants/dtos/update-variant.dto';
import { VariantRepository } from '@components/variants/repositories/variant.repository';
import { PrismaService } from '@core/modules/prisma';
import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, Variant } from '@prisma/client';

@Injectable()
export class VariantService {
  constructor(
    private readonly variantRepository: VariantRepository,
    private readonly prisma: PrismaService
  ) {}

  async findAll(query: QueryVariantDto) {
    return this.variantRepository.findAll(query);
  }

  async findById(id: string) {
    const variant = await this.variantRepository.findById(id);
    if (!variant) {
      throw new NotFoundException(`Không tìm thấy biến thể với id ${id}`);
    }
    return variant;
  }

  async create(dto: CreateVariantDto) {
    await this.assertProductExists(dto.productId);

    const existing = await this.variantRepository.findBySku(dto.sku);
    if (existing) {
      throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
    }

    const data: Prisma.VariantCreateInput = {
      size: dto.size,
      color: dto.color,
      sku: dto.sku,
      price: dto.price,
      stock: dto.stock ?? 0,
      product: {
        connect: {
          id: dto.productId
        }
      }
    };

    try {
      return await this.variantRepository.createVariant(data);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'sku')) {
        throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateVariantDto) {
    await this.findById(id);

    const data: Prisma.VariantUpdateInput = {
      size: dto.size,
      color: dto.color,
      stock: dto.stock,
      ...(dto.price !== undefined && { price: dto.price })
    };

    if (dto.sku) {
      const existing = await this.variantRepository.findBySku(dto.sku);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
      }
      data.sku = dto.sku;
    }

    if (dto.productId) {
      await this.assertProductExists(dto.productId);
      data.product = {
        connect: {
          id: dto.productId
        }
      };
    }

    try {
      return await this.variantRepository.updateVariant(id, data);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'sku')) {
        throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Variant> {
    await this.findById(id);

    try {
      return await this.variantRepository.deleteVariant(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Không thể xóa biến thể đang được tham chiếu trong giỏ hàng hoặc đơn hàng. Bạn có thể cập nhật stock về 0 qua PATCH /v1/variants/:id.'
        );
      }
      throw error;
    }
  }

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true }
    });

    if (!product) {
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với id ${productId}`
      );
    }
  }

  private isUniqueConstraintError(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return target.includes(field);
    }

    return typeof target === 'string' ? target.includes(field) : false;
  }
}
