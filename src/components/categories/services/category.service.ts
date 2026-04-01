import { CreateCategoryDto } from '@components/categories/dtos/create-category.dto';
import { QueryCategoryDto } from '@components/categories/dtos/query-category.dto';
import { UpdateCategoryDto } from '@components/categories/dtos/update-category.dto';
import { CategoryRepository } from '@components/categories/repositories/category.repository';
import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Category, Role } from '@prisma/client';

@Injectable()
export class CategoryService {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async findAll(query: QueryCategoryDto, userRole?: Role) {
    return this.categoryRepository.findAll(query, {
      includeInactive: userRole === Role.ADMIN
    });
  }

  async findById(id: string, userRole?: Role): Promise<Category> {
    const category = await this.categoryRepository.findById(id, {
      includeInactive: userRole === Role.ADMIN
    });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với id ${id}`);
    }
    return category;
  }

  async findBySlug(slug: string, userRole?: Role): Promise<Category> {
    const category = await this.categoryRepository.findBySlug(slug, {
      includeInactive: userRole === Role.ADMIN
    });
    if (!category) {
      throw new NotFoundException(`Không tìm thấy danh mục với slug "${slug}"`);
    }
    return category;
  }

  async findRootCategories(userRole?: Role): Promise<Category[]> {
    return this.categoryRepository.findRootCategories({
      includeInactive: userRole === Role.ADMIN
    });
  }

  async findChildren(parentId: string, userRole?: Role): Promise<Category[]> {
    await this.findById(parentId, userRole);
    return this.categoryRepository.findChildrenByParentId(parentId, {
      includeInactive: userRole === Role.ADMIN
    });
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.categoryRepository.findBySlug(slug, {
      includeInactive: true
    });
    if (existing) {
      throw new ConflictException(`Danh mục với slug "${slug}" đã tồn tại`);
    }

    if (dto.parentId) {
      await this.findById(dto.parentId, Role.ADMIN);
    }

    return this.categoryRepository.createCategory({
      name: dto.name,
      slug,
      description: dto.description,
      isActive: dto.isActive ?? true,
      position: dto.position ?? 0,
      ...(dto.parentId && {
        parent: { connect: { id: dto.parentId } }
      })
    });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.findById(id, Role.ADMIN);

    const updateData: Record<string, any> = { ...dto };

    if (dto.name && !dto.slug) {
      updateData.slug = this.generateSlug(dto.name);
    }

    if (updateData.slug) {
      const existing = await this.categoryRepository.findBySlug(
        updateData.slug as string,
        {
          includeInactive: true
        }
      );
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Danh mục với slug "${updateData.slug}" đã tồn tại`
        );
      }
    }

    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException('Danh mục không thể làm cha của chính nó');
      }
      await this.findById(dto.parentId, Role.ADMIN);
      updateData.parent = { connect: { id: dto.parentId } };
      delete updateData.parentId;
    }

    return this.categoryRepository.updateCategory(id, updateData);
  }

  async softDelete(id: string): Promise<Category> {
    await this.findById(id, Role.ADMIN);
    return this.categoryRepository.updateCategory(id, {
      isActive: false,
      deletedAt: new Date()
    });
  }

  async toggleActive(id: string): Promise<Category> {
    const category = await this.findById(id, Role.ADMIN);
    return this.categoryRepository.updateCategory(id, {
      isActive: !category.isActive
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
}
