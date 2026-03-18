import {
  CreateProductDto,
  ProductImageInputDto
} from '@components/products/dtos/create-product.dto';
import { QueryProductDto } from '@components/products/dtos/query-product.dto';
import { UpdateProductDto } from '@components/products/dtos/update-product.dto';
import { ProductRepository } from '@components/products/repositories/product.repository';
import { PrismaService } from '@core/modules/prisma';
import { sanitizeTiptapDescription } from '@core/utilities/sanitizers/tiptap.sanitizer';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';

type NormalizedImageInput = {
  fileId: string;
  isPrimary: boolean;
  position: number;
};

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly prisma: PrismaService
  ) {}

  async findAll(query: QueryProductDto) {
    return this.productRepository.findAll(query);
  }

  async findById(id: string) {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id ${id}`);
    }
    return product;
  }

  async findBySlug(slug: string) {
    const product = await this.productRepository.findBySlug(slug);
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với slug "${slug}"`);
    }
    return product;
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.productRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException(`Sản phẩm với slug "${slug}" đã tồn tại`);
    }

    await this.assertCategoryExists(dto.categoryId);

    const normalizedImages = this.normalizeImages(dto.images);
    await this.assertFilesExist(normalizedImages.map((image) => image.fileId));

    const { descriptionJson, descriptionHtml } = this.sanitizeDescription(
      dto.description
    );

    const createData: Prisma.ProductCreateInput = {
      slug,
      name: dto.name,
      description: descriptionJson,
      descriptionHtml,
      brand: dto.brand,
      gender: dto.gender,
      styleTags: dto.styleTags,
      material: dto.material,
      season: dto.season,
      fit: dto.fit,
      isActive: dto.isActive ?? true,
      ...(dto.categoryId && {
        category: { connect: { id: dto.categoryId } }
      }),
      ...(normalizedImages.length > 0 && {
        images: {
          create: normalizedImages.map((image) => ({
            isPrimary: image.isPrimary,
            position: image.position,
            file: { connect: { id: image.fileId } }
          }))
        }
      })
    };

    try {
      return await this.productRepository.createProduct(createData);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException(`Sản phẩm với slug "${slug}" đã tồn tại`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id);

    const { descriptionJson, descriptionHtml } = this.sanitizeDescription(
      dto.description
    );

    const updateData: Prisma.ProductUpdateInput = {
      name: dto.name,
      description: descriptionJson,
      descriptionHtml,
      brand: dto.brand,
      gender: dto.gender,
      styleTags: dto.styleTags,
      material: dto.material,
      season: dto.season,
      fit: dto.fit,
      isActive: dto.isActive
    };

    if (dto.slug || (dto.name && !dto.slug)) {
      const nextSlug = dto.slug || this.generateSlug(dto.name as string);
      const existing = await this.productRepository.findBySlug(nextSlug);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Sản phẩm với slug "${nextSlug}" đã tồn tại`
        );
      }
      updateData.slug = nextSlug;
    }

    if (dto.categoryId !== undefined) {
      await this.assertCategoryExists(dto.categoryId);
      updateData.category = dto.categoryId
        ? { connect: { id: dto.categoryId } }
        : { disconnect: true };
    }

    if (dto.images !== undefined) {
      const normalizedImages = this.normalizeImages(dto.images);
      await this.assertFilesExist(
        normalizedImages.map((image) => image.fileId)
      );

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id },
            data: updateData
          });

          await tx.productImage.deleteMany({
            where: { productId: id }
          });

          if (normalizedImages.length > 0) {
            await tx.productImage.createMany({
              data: normalizedImages.map((image) => ({
                productId: id,
                fileId: image.fileId,
                isPrimary: image.isPrimary,
                position: image.position
              }))
            });
          }
        });
      } catch (error) {
        if (this.isUniqueConstraintError(error, 'slug')) {
          throw new ConflictException(
            `Sản phẩm với slug "${updateData.slug as string}" đã tồn tại`
          );
        }
        throw error;
      }

      return this.findById(id);
    }

    try {
      await this.productRepository.updateProduct(id, updateData);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException(
          `Sản phẩm với slug "${updateData.slug as string}" đã tồn tại`
        );
      }
      throw error;
    }

    return this.findById(id);
  }

  async remove(id: string): Promise<Product> {
    await this.findById(id);

    try {
      return await this.productRepository.deleteProduct(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Không thể xóa sản phẩm vì có biến thể đang được tham chiếu trong giỏ hàng/đơn hàng. Dùng endpoint PATCH /v1/products/:id/soft-delete-stock để ngừng bán và đặt tồn kho về 0.'
        );
      }
      throw error;
    }
  }

  async toggleActive(id: string) {
    const product = await this.findById(id);

    return await this.productRepository.updateProduct(id, {
      isActive: !product.isActive
    });
  }

  async softDeleteStock(id: string) {
    await this.findById(id);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          isActive: false
        }
      });

      await tx.variant.updateMany({
        where: { productId: id },
        data: { stock: 0 }
      });
    });

    return this.findById(id);
  }

  private async assertCategoryExists(categoryId?: string | null) {
    if (!categoryId) {
      return;
    }

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true }
    });

    if (!category) {
      throw new NotFoundException(
        `Không tìm thấy danh mục với id ${categoryId}`
      );
    }
  }

  private async assertFilesExist(fileIds: string[]) {
    if (fileIds.length === 0) {
      return;
    }

    const uniqueIds = [...new Set(fileIds)];
    const existingIds =
      await this.productRepository.findExistingFileIds(uniqueIds);

    if (existingIds.length !== uniqueIds.length) {
      const existingSet = new Set(existingIds);
      const missingIds = uniqueIds.filter((id) => !existingSet.has(id));
      throw new NotFoundException(
        `Không tìm thấy file với id: ${missingIds.join(', ')}`
      );
    }
  }

  private normalizeImages(
    images?: ProductImageInputDto[]
  ): NormalizedImageInput[] {
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

  private sanitizeDescription(description?: Record<string, unknown>) {
    if (!description) {
      return {
        descriptionJson: undefined,
        descriptionHtml: undefined
      };
    }

    const sanitized = sanitizeTiptapDescription(description);

    return {
      descriptionJson: sanitized.json as unknown as Prisma.InputJsonValue,
      descriptionHtml: sanitized.html
    };
  }
  private generateSlug(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
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
