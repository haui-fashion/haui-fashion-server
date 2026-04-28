import {
  CreateProductDto,
  ProductImageInputDto
} from '@components/products/dtos/create-product.dto';
import { GenerateProductDescriptionDto } from '@components/products/dtos/generate-product-description.dto';
import { QueryProductDto } from '@components/products/dtos/query-product.dto';
import { UpdateProductDto } from '@components/products/dtos/update-product.dto';
import {
  UpsertVariantGroupDto,
  VariantGroupVariantInputDto
} from '@components/products/dtos/upsert-variant-group.dto';
import { GeneratedProductDescription } from '@components/products/entities/generated-product-description.entity';
import { NormalizedImage } from '@components/products/entities/normalized-image.entity';
import { ProductRepository } from '@components/products/repositories/product.repository';
import { ProductDescriptionGenerationService } from '@components/products/services/product-description-generation.service';
import { PrismaService } from '@core/modules/prisma';
import { TiptapService } from '@core/modules/tiptap';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import {
  EmbeddingSyncStatus,
  Prisma,
  Product,
  ProductOptionType,
  Role
} from '@prisma/client';

@Injectable()
export class ProductService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly prisma: PrismaService,
    private readonly productDescriptionGenerationService: ProductDescriptionGenerationService,
    private readonly tiptapService: TiptapService
  ) {}

  async findAll(query: QueryProductDto, userRole?: Role) {
    const result = await this.productRepository.findAll(query, {
      includeInactive: userRole === Role.ADMIN
    });

    return {
      ...result,
      items: result.items.map((item) => this.toProductListResponse(item as any))
    };
  }

  autocomplete(keyword: string, limit = 8) {
    return this.productRepository.autocomplete(keyword, limit);
  }

  async findById(id: string, userRole?: Role, userId?: string) {
    const product = await this.productRepository.findById(id, {
      includeInactive: userRole === Role.ADMIN
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với id ${id}`);
    }
    return await this.toProductResponse(product as any, userId);
  }

  async findBySlug(slug: string, userRole?: Role, userId?: string) {
    const product = await this.productRepository.findBySlug(slug, {
      includeInactive: userRole === Role.ADMIN
    });
    if (!product) {
      throw new NotFoundException(`Không tìm thấy sản phẩm với slug "${slug}"`);
    }
    return await this.toProductResponse(product as any, userId);
  }

  async findBestSellers(limit: number = 8) {
    const result = await this.productRepository.findBestSellers(limit);
    return {
      ...result,
      items: result.items.map((item) => this.toProductListResponse(item as any))
    };
  }

  async findRecommendations(productId: string, limit: number = 8) {
    const product = await this.productRepository.findById(productId);
    const categoryId = product?.categoryId || null;

    const result = await this.productRepository.findRecommendations(
      productId,
      categoryId,
      limit
    );
    return {
      ...result,
      items: result.items.map((item) => this.toProductListResponse(item as any))
    };
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.productRepository.findBySlug(slug, {
      includeInactive: true
    });
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
      shortDescription: dto.shortDescription,
      brand: dto.brand,
      gender: dto.gender,
      styleTags: dto.styleTags,
      material: dto.material,
      season: dto.season,
      fit: dto.fit,
      isActive: dto.isActive ?? true,
      embeddingDirty: true,
      embeddingSyncStatus: EmbeddingSyncStatus.PENDING,
      embeddingContentHash: null,
      embeddingUpdatedAt: null,
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
      const created = await this.productRepository.createProduct(createData);
      return await this.toProductResponse(created as any);
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'slug')) {
        throw new ConflictException(`Sản phẩm với slug "${slug}" đã tồn tại`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findById(id, Role.ADMIN);
    const shouldMarkEmbeddingDirty = this.hasEmbeddingRelevantChanges(dto);

    const { descriptionJson, descriptionHtml } = this.sanitizeDescription(
      dto.description
    );

    const updateData: Prisma.ProductUpdateInput = {
      name: dto.name,
      description: descriptionJson,
      descriptionHtml,
      shortDescription: dto.shortDescription,
      brand: dto.brand,
      gender: dto.gender,
      styleTags: dto.styleTags,
      material: dto.material,
      season: dto.season,
      fit: dto.fit,
      isActive: dto.isActive,
      ...(shouldMarkEmbeddingDirty && {
        embeddingDirty: true,
        embeddingSyncStatus: EmbeddingSyncStatus.PENDING
      })
    };

    if (dto.slug || (dto.name && !dto.slug)) {
      const nextSlug = dto.slug || this.generateSlug(dto.name as string);
      const existing = await this.productRepository.findBySlug(nextSlug, {
        includeInactive: true
      });
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
            where: {
              productId: id,
              optionValueId: null
            }
          });

          if (normalizedImages.length > 0) {
            await tx.productImage.createMany({
              data: normalizedImages.map((image) => ({
                productId: id,
                optionValueId: null,
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

      return this.findById(id, Role.ADMIN);
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

    return this.findById(id, Role.ADMIN);
  }

  async createVariantGroup(productId: string, dto: UpsertVariantGroupDto) {
    await this.findById(productId, Role.ADMIN);

    const normalizedImages = this.normalizeImages(dto.images);
    await this.assertFilesExist(normalizedImages.map((image) => image.fileId));

    try {
      await this.prisma.$transaction(async (tx) => {
        const colorOptionValue = await this.findOrCreateOptionValue(tx, {
          productId,
          type: ProductOptionType.COLOR,
          value: dto.color,
          hexColor: dto.hexColor
        });

        await this.syncVariantGroup(tx, {
          productId,
          colorOptionValueId: colorOptionValue.id,
          variants: dto.variants
        });

        if (dto.images !== undefined) {
          await this.replaceColorImages(tx, {
            productId,
            colorOptionValueId: colorOptionValue.id,
            images: normalizedImages
          });
        }
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'sku')) {
        throw new ConflictException('SKU đã tồn tại, vui lòng dùng SKU khác');
      }

      if (
        this.isUniqueConstraintError(
          error,
          'variants_product_color_size_unique'
        )
      ) {
        throw new ConflictException(
          'Có biến thể bị trùng tổ hợp màu và size trong cùng sản phẩm'
        );
      }

      throw error;
    }

    return this.findById(productId, Role.ADMIN);
  }

  async updateVariantGroup(
    productId: string,
    colorOptionValueId: string,
    dto: UpsertVariantGroupDto
  ) {
    await this.findById(productId, Role.ADMIN);

    const existingColorValue = await this.prisma.productOptionValue.findFirst({
      where: {
        id: colorOptionValueId,
        option: {
          productId,
          name: ProductOptionType.COLOR
        }
      },
      select: {
        id: true,
        value: true
      }
    });

    if (!existingColorValue) {
      throw new NotFoundException(
        `Không tìm thấy nhóm màu với id ${colorOptionValueId}`
      );
    }

    const normalizedImages = this.normalizeImages(dto.images);
    await this.assertFilesExist(normalizedImages.map((image) => image.fileId));

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.color !== undefined || dto.hexColor !== undefined) {
          const updateData: Prisma.ProductOptionValueUpdateInput = {};

          if (dto.color !== undefined) {
            const nextColor = dto.color.trim();

            if (!nextColor) {
              throw new BadRequestException('Màu sắc không được để trống');
            }

            const duplicateColor = await tx.productOptionValue.findFirst({
              where: {
                id: {
                  not: colorOptionValueId
                },
                option: {
                  productId,
                  name: ProductOptionType.COLOR
                },
                value: {
                  equals: nextColor,
                  mode: 'insensitive'
                }
              },
              select: {
                id: true
              }
            });

            if (duplicateColor) {
              throw new ConflictException(
                `Nhóm màu "${nextColor}" đã tồn tại trong sản phẩm`
              );
            }

            updateData.value = nextColor;
          }

          if (dto.hexColor !== undefined) {
            updateData.hexColor = dto.hexColor;
          }

          if (Object.keys(updateData).length > 0) {
            await tx.productOptionValue.update({
              where: {
                id: colorOptionValueId
              },
              data: updateData
            });
          }
        }

        await this.syncVariantGroup(tx, {
          productId,
          colorOptionValueId,
          variants: dto.variants
        });

        if (dto.images !== undefined) {
          await this.replaceColorImages(tx, {
            productId,
            colorOptionValueId,
            images: normalizedImages
          });
        }
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error, 'sku')) {
        throw new ConflictException('SKU đã tồn tại, vui lòng dùng SKU khác');
      }

      if (
        this.isUniqueConstraintError(
          error,
          'variants_product_color_size_unique'
        )
      ) {
        throw new ConflictException(
          'Có biến thể bị trùng tổ hợp màu và size trong cùng sản phẩm'
        );
      }

      throw error;
    }

    return this.findById(productId, Role.ADMIN);
  }

  async remove(id: string): Promise<Product> {
    await this.findById(id, Role.ADMIN);

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
    const product = await this.findById(id, Role.ADMIN);

    const updated = await this.productRepository.updateProduct(id, {
      isActive: !product.isActive,
      embeddingDirty: true,
      embeddingSyncStatus: EmbeddingSyncStatus.PENDING
    });

    return await this.toProductResponse(updated as any);
  }

  async softDeleteStock(id: string) {
    await this.findById(id, Role.ADMIN);

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          isActive: false,
          embeddingDirty: true,
          embeddingSyncStatus: EmbeddingSyncStatus.PENDING
        }
      });

      await tx.variant.updateMany({
        where: { productId: id },
        data: { stock: 0 }
      });
    });

    return this.findById(id, Role.ADMIN);
  }

  async generateDescriptionJson(dto: GenerateProductDescriptionDto) {
    let sections: GeneratedProductDescription;
    try {
      sections =
        await this.productDescriptionGenerationService.generateProductSections(
          dto
        );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadGatewayException(
        'Không thể sinh mô tả sản phẩm từ Gemini. Vui lòng thử lại.'
      );
    }

    const tiptapJson = this.buildCommonDescriptionTiptap(sections);
    const sanitized = this.tiptapService.sanitizeDescription(tiptapJson);

    return {
      description: sanitized.json,
      descriptionHtml: sanitized.html,
      sections
    };
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

    const uniqueIds = Array.from(new Set(fileIds));
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

  private normalizeImages(images?: ProductImageInputDto[]): NormalizedImage[] {
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

  private async syncVariantGroup(
    tx: Prisma.TransactionClient,
    input: {
      productId: string;
      colorOptionValueId: string;
      variants: VariantGroupVariantInputDto[];
    }
  ) {
    const existingVariants = await tx.variant.findMany({
      where: {
        productId: input.productId,
        colorOptionValueId: input.colorOptionValueId
      },
      select: {
        id: true
      }
    });

    const existingIdSet = new Set(
      existingVariants.map((variant) => variant.id)
    );
    const keepIds = new Set<string>();

    for (const item of input.variants) {
      if (item.id && !existingIdSet.has(item.id)) {
        throw new BadRequestException(
          `Biến thể ${item.id} không thuộc nhóm màu đang chỉnh sửa`
        );
      }

      const sizeOptionValue = await this.findOrCreateOptionValue(tx, {
        productId: input.productId,
        type: ProductOptionType.SIZE,
        value: item.size
      });

      if (item.id) {
        await tx.variant.update({
          where: { id: item.id },
          data: {
            sku: item.sku,
            price: item.price,
            stock: item.stock ?? 0,
            sizeOptionValueId: sizeOptionValue.id,
            colorOptionValueId: input.colorOptionValueId
          }
        });

        keepIds.add(item.id);
        continue;
      }

      const created = await tx.variant.create({
        data: {
          productId: input.productId,
          sku: item.sku,
          price: item.price,
          stock: item.stock ?? 0,
          sizeOptionValueId: sizeOptionValue.id,
          colorOptionValueId: input.colorOptionValueId
        },
        select: {
          id: true
        }
      });

      keepIds.add(created.id);
    }

    const toDelete = existingVariants
      .map((variant) => variant.id)
      .filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      await tx.variant.deleteMany({
        where: {
          id: {
            in: toDelete
          }
        }
      });
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

  private hasEmbeddingRelevantChanges(dto: UpdateProductDto): boolean {
    return (
      dto.name !== undefined ||
      dto.slug !== undefined ||
      dto.description !== undefined ||
      dto.shortDescription !== undefined ||
      dto.brand !== undefined ||
      dto.gender !== undefined ||
      dto.styleTags !== undefined ||
      dto.material !== undefined ||
      dto.season !== undefined ||
      dto.fit !== undefined ||
      dto.categoryId !== undefined ||
      dto.isActive !== undefined
    );
  }

  private async toProductResponse(product: any, userId?: string) {
    const allImages = Array.isArray(product.images) ? product.images : [];
    const fallbackImages = allImages.filter(
      (image: any) => !image.optionValueId
    );
    const variants = Array.isArray(product.variants) ? product.variants : [];

    const variantGroupsByColor = new Map<string, any>();

    variants.forEach((variant: any) => {
      const colorId = variant.colorOptionValueId || '__default__';

      if (!variantGroupsByColor.has(colorId)) {
        const colorSpecificImages = allImages.filter(
          (image: any) => image.optionValueId === variant.colorOptionValueId
        );

        variantGroupsByColor.set(colorId, {
          colorOptionValueId: variant.colorOptionValueId ?? null,
          color: variant.colorOptionValue?.value ?? null,
          hexColor: variant.colorOptionValue?.hexColor ?? null,
          images:
            colorSpecificImages.length > 0
              ? colorSpecificImages
              : fallbackImages,
          variants: []
        });
      }

      const group = variantGroupsByColor.get(colorId);
      group.variants.push({
        ...variant,
        color: variant.colorOptionValue?.value,
        size: variant.sizeOptionValue?.value,
        hexColor: variant.colorOptionValue?.hexColor ?? null
      });
    });

    const variantGroups = Array.from(variantGroupsByColor.values());

    if (variantGroups.length === 0 && fallbackImages.length > 0) {
      variantGroups.push({
        colorOptionValueId: null,
        color: null,
        hexColor: null,
        images: fallbackImages,
        variants: []
      });
    }

    // Check if user can review this product (if they have purchased it)
    let canReview = false;
    if (userId) {
      canReview = await this.userHasPurchasedProduct(userId, product.id);
    }

    return {
      ...product,
      variantGroups,
      canReview
    };
  }

  private async userHasPurchasedProduct(
    userId: string,
    productId: string
  ): Promise<boolean> {
    const purchase = await this.prisma.orderItem.findFirst({
      where: {
        variant: {
          productId
        },
        order: {
          userId
        }
      },
      select: { id: true }
    });

    return !!purchase;
  }

  private toProductListResponse(product: any) {
    const firstImage = product.images?.[0] ?? null;
    const variantFirstImages = Array.isArray(product.variants)
      ? product.variants
          .map((variant: any) => variant?.colorOptionValue?.images?.[0] ?? null)
          .filter((image: any) => Boolean(image))
      : [];

    const dedupImages = new Map<string, any>();

    variantFirstImages.forEach((image: any) => {
      if (image?.id) {
        dedupImages.set(image.id, image);
      }
    });

    const images = Array.from(dedupImages.values());

    if (images.length === 0 && firstImage) {
      images.push(firstImage);
    }

    const image = images[0] ?? null;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      gender: product.gender,
      material: product.material,
      season: product.season,
      fit: product.fit,
      isActive: product.isActive,
      categoryId: product.categoryId,
      category: product.category,
      image,
      images,
      numberOfVariants: product.numberOfVariants ?? 0,
      minVariantPrice: product.minVariantPrice ?? null,
      maxVariantPrice: product.maxVariantPrice ?? null,
      totalVariantStock: product.totalVariantStock ?? 0,
      hexColors: product.hexColors ?? [],
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }

  private buildCommonDescriptionTiptap(
    sections: GeneratedProductDescription
  ): Record<string, unknown> {
    const content: Array<Record<string, unknown>> = [
      this.headingNode('Tên sản phẩm'),
      this.paragraphNode(sections.productName),
      this.headingNode('Mô tả ngắn (Short Preview)'),
      this.paragraphNode(sections.shortPreview),
      this.headingNode('Điểm nổi bật'),
      this.listNode(sections.keyFeatures),
      this.headingNode('Chất liệu và cấu tạo'),
      this.listNode(sections.materialAndBuild),
      this.headingNode('Hướng dẫn bảo quản (Preserver)'),
      this.listNode(sections.preserver),
      this.headingNode('Kích thước và form dáng'),
      this.listNode(sections.sizeAndFit),
      this.headingNode('Gợi ý phối đồ'),
      this.listNode(sections.stylingSuggestions),
      this.headingNode('Bộ sản phẩm gồm'),
      this.listNode(sections.packageIncludes),
      this.headingNode('SEO Keywords'),
      this.listNode(sections.seoKeywords)
    ];

    return {
      type: 'doc',
      content
    };
  }

  private headingNode(text: string): Record<string, unknown> {
    return {
      type: 'heading',
      attrs: { level: 3 },
      content: [
        {
          type: 'text',
          text
        }
      ]
    };
  }

  private paragraphNode(text: string): Record<string, unknown> {
    return {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text
        }
      ]
    };
  }

  private listNode(items: string[]): Record<string, unknown> {
    const normalizedItems = items.length > 0 ? items : ['Đang cập nhật'];

    return {
      type: 'bulletList',
      content: normalizedItems.map((item) => ({
        type: 'listItem',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: item
              }
            ]
          }
        ]
      }))
    };
  }

  private sanitizeDescription(description?: Record<string, unknown>) {
    if (!description) {
      return {
        descriptionJson: undefined,
        descriptionHtml: undefined
      };
    }

    const sanitized = this.tiptapService.sanitizeDescription(description);

    return {
      descriptionJson: sanitized.json as unknown as Prisma.InputJsonValue,
      descriptionHtml: sanitized.html
    };
  }
}
