import { CreateVariantDto } from '@components/variants/dtos/create-variant.dto';
import { QueryVariantDto } from '@components/variants/dtos/query-variant.dto';
import { UpdateVariantDto } from '@components/variants/dtos/update-variant.dto';
import { VariantService } from '@components/variants/services/variant.service';
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

@ApiTags('Variants')
@Controller({ path: 'variants', version: '1' })
export class VariantController {
  constructor(private readonly variantService: VariantService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new variant' })
  async create(@Body() dto: CreateVariantDto) {
    return this.variantService.create(dto);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Public list variants (active products only)'
  })
  async findAll(@Query() query: QueryVariantDto) {
    return this.variantService.findAll(query);
  }

  @Get('admin')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin list variants (active/inactive/all)' })
  async findAllForAdmin(@Query() query: QueryVariantDto) {
    return this.variantService.findAll(query, Role.ADMIN);
  }

  @Get('admin/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get variant by ID' })
  async findOneForAdmin(@Param('id') id: string) {
    return this.variantService.findById(id, Role.ADMIN);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Public get variant by ID (active product only)' })
  async findOne(@Param('id') id: string) {
    return this.variantService.findById(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a variant' })
  async update(@Param('id') id: string, @Body() dto: UpdateVariantDto) {
    return this.variantService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a variant' })
  async remove(@Param('id') id: string) {
    return this.variantService.remove(id);
  }
}
