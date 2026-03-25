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
import { Prisma, ProductOptionType, Role, Variant } from '@prisma/client';

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
    const result = await this.variantRepository.findAll(query, {
      includeInactive: userRole === Role.ADMIN
    });

    return {
      ...result,
      items: result.items.map((item) => this.toVariantResponse(item as any))
    };
  }

  async findById(id: string, userRole?: Role) {
    const variant = await this.variantRepository.findById(id, {
      includeInactive: userRole === Role.ADMIN
    });
    if (!variant) {
      throw new NotFoundException(`Không tìm thấy biến thể với id ${id}`);
    }

    return this.toVariantResponse(variant as any);
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

    try {
      const createdVariantId = await this.prisma.$transaction(async (tx) => {
        const colorOptionValue = await this.findOrCreateOptionValue(tx, {
          productId: dto.productId,
          type: ProductOptionType.COLOR,
          value: dto.color,
          hexColor: dto.hexColor
        });

        const sizeOptionValue = await this.findOrCreateOptionValue(tx, {
          productId: dto.productId,
          type: ProductOptionType.SIZE,
          value: dto.size
        });

        const created = await tx.variant.create({
          data: {
            sku: dto.sku,
            price: dto.price,
            stock: dto.stock ?? 0,
            product: {
              connect: {
                id: dto.productId
              }
            },
            colorOptionValue: {
              connect: {
                id: colorOptionValue.id
              }
            },
            sizeOptionValue: {
              connect: {
                id: sizeOptionValue.id
              }
            }
          },
          select: { id: true }
        });

        if (normalizedImages.length > 0) {
          await this.replaceColorImages(tx, {
            productId: dto.productId,
            colorOptionValueId: colorOptionValue.id,
            images: normalizedImages
          });
        }

        return created.id;
      });

      return this.findById(createdVariantId, Role.ADMIN);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'sku')) {
        throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
      }

      if (
        this.isUniqueConstraintError(
          error,
          'variants_product_color_size_unique'
        )
      ) {
        throw new ConflictException(
          `Biến thể với tổ hợp màu "${dto.color}" và size "${dto.size}" đã tồn tại trong sản phẩm`
        );
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateVariantDto) {
    const current = await this.prisma.variant.findUnique({
      where: { id },
      include: {
        colorOptionValue: true,
        sizeOptionValue: true
      }
    });

    if (!current) {
      throw new NotFoundException(`Không tìm thấy biến thể với id ${id}`);
    }

    if (dto.sku) {
      const existing = await this.variantRepository.findBySku(dto.sku, {
        includeInactive: true
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
      }
    }

    const targetProductId = dto.productId ?? current.productId;
    if (dto.productId) {
      await this.assertProductExists(dto.productId);
    }

    const targetColor = dto.color ?? current.colorOptionValue.value;
    const targetSize = dto.size ?? current.sizeOptionValue.value;

    const normalizedImages = this.normalizeImages(dto.images);
    if (dto.images !== undefined) {
      await this.assertFilesExist(normalizedImages.map((img) => img.fileId));
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const colorOptionValue = await this.findOrCreateOptionValue(tx, {
          productId: targetProductId,
          type: ProductOptionType.COLOR,
          value: targetColor,
          hexColor: dto.hexColor
        });

        const sizeOptionValue = await this.findOrCreateOptionValue(tx, {
          productId: targetProductId,
          type: ProductOptionType.SIZE,
          value: targetSize
        });

        const data: Prisma.VariantUpdateInput = {
          stock: dto.stock,
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.sku && { sku: dto.sku }),
          ...(dto.productId && {
            product: {
              connect: {
                id: targetProductId
              }
            }
          }),
          colorOptionValue: {
            connect: {
              id: colorOptionValue.id
            }
          },
          sizeOptionValue: {
            connect: {
              id: sizeOptionValue.id
            }
          }
        };

        await tx.variant.update({
          where: { id },
          data
        });

        if (dto.images !== undefined) {
          await this.replaceColorImages(tx, {
            productId: targetProductId,
            colorOptionValueId: colorOptionValue.id,
            images: normalizedImages
          });
        }
      });

      return this.findById(id, Role.ADMIN);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'sku')) {
        throw new ConflictException(`Biến thể với sku "${dto.sku}" đã tồn tại`);
      }

      if (
        this.isUniqueConstraintError(
          error,
          'variants_product_color_size_unique'
        )
      ) {
        throw new ConflictException(
          `Biến thể với tổ hợp màu "${targetColor}" và size "${targetSize}" đã tồn tại trong sản phẩm`
        );
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

    const uniqueIds = Array.from(new Set(fileIds));
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

  private async findOrCreateOptionValue(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      type: ProductOptionType;
      value: string;
      hexColor?: string;
    }
  ) {
    const trimmedValue = input.value.trim();
    const normalizedValue =
      input.type === ProductOptionType.COLOR
        ? trimmedValue.toLowerCase()
        : trimmedValue;

    if (!normalizedValue) {
      throw new BadRequestException('Giá trị option không được để trống');
    }

    const option = await tx.productOption.upsert({
      where: {
        productId_name: {
          productId: input.productId,
          name: input.type
        }
      },
      create: {
        productId: input.productId,
        name: input.type
      },
      update: {}
    });

    return tx.productOptionValue.upsert({
      where: {
        optionId_value: {
          optionId: option.id,
          value: normalizedValue
        }
      },
      create: {
        optionId: option.id,
        value: normalizedValue,
        ...(input.type === ProductOptionType.COLOR && input.hexColor
          ? { hexColor: input.hexColor }
          : {})
      },
      update:
        input.type === ProductOptionType.COLOR && input.hexColor
          ? { hexColor: input.hexColor }
          : {}
    });
  }

  private async replaceColorImages(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      colorOptionValueId: string;
      images: NormalizedImage[];
    }
  ) {
    await tx.productImage.deleteMany({
      where: {
        productId: input.productId,
        optionValueId: input.colorOptionValueId
      }
    });

    if (input.images.length === 0) {
      return;
    }

    await tx.productImage.createMany({
      data: input.images.map((image) => ({
        productId: input.productId,
        optionValueId: input.colorOptionValueId,
        fileId: image.fileId,
        isPrimary: image.isPrimary,
        position: image.position
      }))
    });
  }

  private toVariantResponse(variant: any) {
    const colorSpecificImages =
      variant.product?.images?.filter(
        (image: any) => image.optionValueId === variant.colorOptionValueId
      ) ?? [];

    const fallbackImages =
      variant.product?.images?.filter((image: any) => !image.optionValueId) ??
      [];

    return {
      ...variant,
      color: variant.colorOptionValue?.value,
      size: variant.sizeOptionValue?.value,
      hexColor: variant.colorOptionValue?.hexColor ?? null,
      images:
        colorSpecificImages.length > 0 ? colorSpecificImages : fallbackImages
    };
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
