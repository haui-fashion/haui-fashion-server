import { CreateVariantDto } from '@components/variants/dtos/create-variant.dto';
import { QueryVariantDto } from '@components/variants/dtos/query-variant.dto';
import { UpdateVariantDto } from '@components/variants/dtos/update-variant.dto';
import { VariantService } from '@components/variants/services/variant.service';
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
    summary: 'Get all variants with pagination, sorting, and filtering'
  })
  async findAll(@Query() query: QueryVariantDto) {
    return this.variantService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a variant by ID' })
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
