import { CreateCategoryDto } from '@components/categories/dtos/create-category.dto';
import { QueryCategoryDto } from '@components/categories/dtos/query-category.dto';
import { UpdateCategoryDto } from '@components/categories/dtos/update-category.dto';
import { CategoryService } from '@components/categories/services/category.service';
import { Public } from '@core/utilities/decorators';
import { Roles } from '@core/utilities/decorators/roles.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Categories')
@Controller({ path: 'categories', version: '1' })
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new category' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Public list categories (active only)'
  })
  async findAll(@Query() query: QueryCategoryDto) {
    return this.categoryService.findAll(query);
  }

  @Get('roots')
  @Public()
  @ApiOperation({ summary: 'Public get root categories (active only)' })
  async findRoots() {
    return this.categoryService.findRootCategories();
  }

  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Public get category by slug (active only)' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin list categories (active/inactive/all)' })
  async findAllForAdmin(@Query() query: QueryCategoryDto) {
    return this.categoryService.findAll(query, Role.ADMIN);
  }

  @Get('admin/roots')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get root categories' })
  async findRootsForAdmin() {
    return this.categoryService.findRootCategories(Role.ADMIN);
  }

  @Get('admin/slug/:slug')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get category by slug' })
  async findBySlugForAdmin(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug, Role.ADMIN);
  }

  @Get('admin/:id/children')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get child categories of a parent' })
  async findChildrenForAdmin(@Param('id') id: string) {
    return this.categoryService.findChildren(id, Role.ADMIN);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get category by ID' })
  async findOneForAdmin(@Param('id') id: string) {
    return this.categoryService.findById(id, Role.ADMIN);
  }

  @Get(':id/children')
  @Public()
  @ApiOperation({
    summary: 'Public get child categories of a parent (active only)'
  })
  async findChildren(@Param('id') id: string) {
    return this.categoryService.findChildren(id);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Public get category by ID (active only)' })
  async findOne(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a category' })
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoryService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Toggle category active status' })
  async toggleActive(@Param('id') id: string) {
    return this.categoryService.toggleActive(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft delete a category' })
  async remove(@Param('id') id: string) {
    return this.categoryService.softDelete(id);
  }
}
