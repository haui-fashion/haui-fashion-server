import { CreateCategoryDto } from '@components/categories/dtos/create-category.dto';
import { QueryCategoryDto } from '@components/categories/dtos/query-category.dto';
import { UpdateCategoryDto } from '@components/categories/dtos/update-category.dto';
import { CategoryService } from '@components/categories/services/category.service';
import { Public } from '@core/utilities/decorators/public.decorator';
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
    summary: 'Get all categories with pagination, sorting, and filtering'
  })
  async findAll(@Query() query: QueryCategoryDto) {
    return this.categoryService.findAll(query);
  }

  @Get('roots')
  @Public()
  @ApiOperation({ summary: 'Get all root categories (no parent)' })
  async findRoots() {
    return this.categoryService.findRootCategories();
  }

  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Get a category by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a category by ID' })
  async findOne(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Get(':id/children')
  @Public()
  @ApiOperation({ summary: 'Get child categories of a parent' })
  async findChildren(@Param('id') id: string) {
    return this.categoryService.findChildren(id);
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
