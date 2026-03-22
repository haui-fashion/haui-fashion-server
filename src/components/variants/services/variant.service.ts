import {
  CreateVariantDto,
  VariantImageInputDto
} from '@components/variants/dtos/create-variant.dto';
import { QueryVariantDto } from '@components/variants/dtos/query-variant.dto';
import { UpdateVariantDto } from '@components/variants/dtos/update-variant.dto';
import { VariantRepository } from '@components/variants/repositories/variant.repository';
import { PrismaService } from '@core/modules/prisma';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, Role, Variant } from '@prisma/client';

interface NormalizedImage {
  fileId: string;
  isPrimary: boolean;
  position: number;
}

@Injectable()
export class VariantService {
  constructor(
    private readonly variantRepository: VariantRepository,
    private readonly prisma: PrismaService
  ) {}

  async findAll(query: QueryVariantDto, userRole?: Role) {
    return this.variantRepository.findAll(query, {
      includeInactive: userRole === Role.ADMIN
    });
  }

  async findById(id: string, userRole?: Role) {
    const variant = await this.variantRepository.findById(id, {
      includeInactive: userRole === Role.ADMIN
    });
    if (!variant) {
      throw new NotFoundException(`Không tìm thấy biến thể với id ${id}`);
    }
    return variant;
  }

  async create(dto: CreateVariantDto) {
    await this.assertProductExists(dto.productId);

    const existing = await this.variantRepository.findBySku(dto.sku, {
      includeInactive: true
    });
    if (existing) {
      throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
    }

    const normalizedImages = this.normalizeImages(dto.images);
    await this.assertFilesExist(normalizedImages.map((img) => img.fileId));

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
      },
      ...(normalizedImages.length > 0 && {
        images: {
          create: normalizedImages.map((img) => ({
            isPrimary: img.isPrimary,
            position: img.position,
            file: { connect: { id: img.fileId } }
          }))
        }
      })
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
    await this.findById(id, Role.ADMIN);

    const data: Prisma.VariantUpdateInput = {
      size: dto.size,
      color: dto.color,
      stock: dto.stock,
      ...(dto.price !== undefined && { price: dto.price })
    };

    if (dto.sku) {
      const existing = await this.variantRepository.findBySku(dto.sku, {
        includeInactive: true
      });
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

    if (dto.images !== undefined) {
      const normalizedImages = this.normalizeImages(dto.images);
      await this.assertFilesExist(normalizedImages.map((img) => img.fileId));

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.variant.update({
            where: { id },
            data
          });

          await tx.variantImage.deleteMany({
            where: { variantId: id }
          });

          if (normalizedImages.length > 0) {
            await tx.variantImage.createMany({
              data: normalizedImages.map((img) => ({
                variantId: id,
                fileId: img.fileId,
                isPrimary: img.isPrimary,
                position: img.position
              }))
            });
          }
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error, 'sku')) {
          throw new ConflictException(
            `Biến thể với sku "${dto.sku}" đã tồn tại`
          );
        }
        throw error;
      }

      return this.findById(id, Role.ADMIN);
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
    await this.findById(id, Role.ADMIN);

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

  private normalizeImages(images?: VariantImageInputDto[]): NormalizedImage[] {
    if (!images || images.length === 0) {
      return [];
    }

    const normalized = images.map((image, index) => {
      const fileId = image.fileId || image.file?.id;

      if (!fileId) {
        throw new BadRequestException(
          'Mỗi ảnh phải có fileId hoặc file.id hợp lệ'
        );
      }

      return {
        fileId,
        isPrimary: image.isPrimary ?? false,
        position: image.position ?? index
      };
    });

    const seen = new Set<string>();
    const deduped = normalized.filter((image) => {
      if (seen.has(image.fileId)) {
        return false;
      }
      seen.add(image.fileId);
      return true;
    });

    const primaryCount = deduped.filter((image) => image.isPrimary).length;
    if (primaryCount === 0 && deduped.length > 0) {
      deduped[0].isPrimary = true;
    }
    if (primaryCount > 1) {
      let marked = false;
      deduped.forEach((image) => {
        if (image.isPrimary && !marked) {
          marked = true;
          return;
        }
        image.isPrimary = false;
      });
    }

    return deduped;
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

  private async assertFilesExist(fileIds: string[]) {
    if (fileIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(fileIds)];
    const existing = await this.prisma.file.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true }
    });

    if (existing.length !== uniqueIds.length) {
      const existingSet = new Set(existing.map((f) => f.id));
      const missingIds = uniqueIds.filter((id) => !existingSet.has(id));
      throw new NotFoundException(
        `Không tìm thấy file với id: ${missingIds.join(', ')}`
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
