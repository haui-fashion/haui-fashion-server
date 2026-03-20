import { BatchJobOrchestratorService } from '@components/product-embedding/services/batch-job-orchestrator.service';
import { CreateProductDto } from '@components/products/dtos/create-product.dto';
import { GenerateProductDescriptionDto } from '@components/products/dtos/generate-product-description.dto';
import { QueryProductDto } from '@components/products/dtos/query-product.dto';
import { SyncProductEmbeddingDto } from '@components/products/dtos/sync-product-embedding-by-id.dto';
import { SyncProductEmbeddingsDto } from '@components/products/dtos/sync-product-embeddings.dto';
import { UpdateProductDto } from '@components/products/dtos/update-product.dto';
import { ProductService } from '@components/products/services/product.service';
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

@ApiTags('Products')
@Controller({ path: 'products', version: '1' })
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly batchJobOrchestratorService: BatchJobOrchestratorService
  ) {}

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

  @Post('embeddings/sync')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Start embedding batch pipeline'
  })
  syncEmbeddings(@Body() dto: SyncProductEmbeddingsDto) {
    return this.batchJobOrchestratorService.startPipeline({
      force: dto.force,
      limit: dto.limit
    });
  }

  @Post('embeddings/resync')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Force start embedding batch pipeline'
  })
  resyncEmbeddings(@Body() dto: SyncProductEmbeddingsDto) {
    return this.batchJobOrchestratorService.startPipeline({
      force: true,
      limit: dto.limit
    });
  }

  @Post('embeddings/sync/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Run pipeline for a specific product' })
  syncEmbeddingById(
    @Param('id') id: string,
    @Body() dto: SyncProductEmbeddingDto
  ) {
    return this.batchJobOrchestratorService.startPipeline({
      productId: id,
      force: dto.force
    });
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Public list products (active only)'
  })
  findAll(@Query() query: QueryProductDto) {
    return this.productService.findAll(query);
  }

  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Public get product by slug (active only)' })
  findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin list products (active/inactive/all)' })
  findAllForAdmin(@Query() query: QueryProductDto) {
    return this.productService.findAll(query, Role.ADMIN);
  }

  @Get('admin/slug/:slug')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get product by slug' })
  findBySlugForAdmin(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug, Role.ADMIN);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get product by ID' })
  findOneForAdmin(@Param('id') id: string) {
    return this.productService.findById(id, Role.ADMIN);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Public get product by ID (active only)' })
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
