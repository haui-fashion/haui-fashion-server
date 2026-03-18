import { FileDto } from '@common/dtos/file.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { IsTiptapDocument } from '@core/utilities/validators/is-tiptap-document.validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class ProductImageInputDto {
  @ApiPropertyOptional()
  @Label('ID tệp đã tải lên')
  @IsOptional()
  @ValidateIf((o: ProductImageInputDto) => !o.file)
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional({ type: () => FileDto })
  @Label('Thông tin tệp')
  @IsOptional()
  @ValidateIf((o: ProductImageInputDto) => !o.fileId)
  @IsObject()
  @ValidateNested()
  @Type(() => FileDto)
  file?: FileDto;

  @ApiPropertyOptional({ default: false })
  @Label('Ảnh chính')
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @Label('Vị trí')
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  position?: number;
}

export class CreateProductDto {
  @ApiProperty()
  @Label('Tên sản phẩm')
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @Label('Slug')
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ type: Object, description: 'Tiptap JSON document' })
  @Label('Mô tả')
  @IsOptional()
  @IsObject()
  @IsTiptapDocument()
  description?: Record<string, unknown>;

  @ApiPropertyOptional()
  @Label('Thương hiệu')
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ enum: Gender })
  @Label('Giới tính')
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách style tags. Lưu dưới dạng JSON array.'
  })
  @Label('Tags')
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  styleTags?: string[];

  @ApiPropertyOptional()
  @Label('Chất liệu')
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional()
  @Label('Mùa')
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional()
  @Label('Form')
  @IsOptional()
  @IsString()
  fit?: string;

  @ApiPropertyOptional({ default: true })
  @Label('Đang hoạt động')
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @Label('ID danh mục')
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    type: () => [ProductImageInputDto],
    description: 'Hỗ trợ cả fileId và file dto (id/url/fileName).'
  })
  @Label('Danh sách ảnh sản phẩm')
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];
}
