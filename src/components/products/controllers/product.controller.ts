import { CreateProductDto } from '@components/products/dtos/create-product.dto';
import { GenerateProductDescriptionDto } from '@components/products/dtos/generate-product-description.dto';
import { QueryProductDto } from '@components/products/dtos/query-product.dto';
import { UpdateProductDto } from '@components/products/dtos/update-product.dto';
import { ProductService } from '@components/products/services/product.service';
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

@ApiTags('Products')
@Controller({ path: 'products', version: '1' })
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new product' })
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Post('ai/generate-description')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Generate Tiptap product description JSON from product data and images using Gemini'
  })
  generateDescription(@Body() dto: GenerateProductDescriptionDto) {
    return this.productService.generateDescriptionJson(dto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Get all products with pagination, sorting, and filtering'
  })
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAll(query);
  }

  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Get a product by slug' })
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a product by ID' })
  findOne(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Patch(':id/toggle-active')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Toggle product active status' })
  toggleActive(@Param('id') id: string) {
    return this.productService.toggleActive(id);
  }

  @Patch(':id/soft-delete-stock')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      'Soft delete product by deactivating and setting all variant stock to 0'
  })
  softDeleteStock(@Param('id') id: string) {
    return this.productService.softDeleteStock(id);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
