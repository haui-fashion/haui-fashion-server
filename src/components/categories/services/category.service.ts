import { CreateCategoryDto } from '@components/categories/dtos/create-category.dto';
import { QueryCategoryDto } from '@components/categories/dtos/query-category.dto';
import { UpdateCategoryDto } from '@components/categories/dtos/update-category.dto';
import { CategoryRepository } from '@components/categories/repositories/category.repository';
import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Category } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async findAll(query: QueryCategoryDto) {
    return this.categoryRepository.findAll(query);
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findBySlug(slug);
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }
    return category;
  }

  async findRootCategories(): Promise<Category[]> {
    return this.categoryRepository.findRootCategories();
  }

  async findChildren(parentId: string): Promise<Category[]> {
    await this.findById(parentId);
    return this.categoryRepository.findChildrenByParentId(parentId);
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.categoryRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException(
        `Category with slug "${slug}" already exists`
      );
    }

    if (dto.parentId) {
      await this.findById(dto.parentId);
    }

    return this.categoryRepository.createCategory({
      name: dto.name,
      slug,
      description: dto.description,
      imageUrl: dto.imageUrl,
      isActive: dto.isActive ?? true,
      position: dto.position ?? 0,
      ...(dto.parentId && {
        parent: { connect: { id: dto.parentId } }
      })
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findById(id);

    const updateData: Record<string, any> = { ...dto };

    if (dto.name && !dto.slug) {
      updateData.slug = this.generateSlug(dto.name);
    }

    if (updateData.slug) {
      const existing = await this.categoryRepository.findBySlug(
        updateData.slug as string
      );
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Category with slug "${updateData.slug}" already exists`
        );
      }
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('A category cannot be its own parent');
      }
      await this.findById(dto.parentId);
      updateData.parent = { connect: { id: dto.parentId } };
      delete updateData.parentId;
    }

    return this.categoryRepository.updateCategory(id, updateData);
  }

  async softDelete(id: string): Promise<Category> {
    await this.findById(id);
    return this.categoryRepository.updateCategory(id, {
      deletedAt: new Date()
    });
  }

  async toggleActive(id: string): Promise<Category> {
    const category = await this.findById(id);
    return this.categoryRepository.updateCategory(id, {
      isActive: !category.isActive
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
