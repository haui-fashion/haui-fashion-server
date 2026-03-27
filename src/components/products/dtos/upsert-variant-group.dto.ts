import { ProductImageInputDto } from '@components/products/dtos/create-product.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';

export class VariantGroupVariantInputDto {
  @ApiPropertyOptional()
  @Label('ID biến thể (dùng khi cập nhật)')
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @Label('Kích cỡ')
  @IsNotEmpty()
  @IsString()
  size: string;

  @ApiProperty()
  @Label('SKU')
  @IsNotEmpty()
  @IsString()
  sku: string;

  @ApiProperty()
  @Label('Giá')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiPropertyOptional({ default: 0 })
  @Label('Tồn kho')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;
}

export class UpsertVariantGroupDto {
  @ApiProperty()
  @Label('Màu sắc')
  @IsNotEmpty()
  @IsString()
  color: string;

  @ApiPropertyOptional()
  @Label('Mã màu hex')
  @IsOptional()
  @IsString()
  hexColor?: string;

  @ApiPropertyOptional({
    type: () => [ProductImageInputDto],
    description:
      'Ảnh theo nhóm màu. Hỗ trợ cả fileId và file dto (id/url/fileName).'
  })
  @Label('Danh sách ảnh theo màu')
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductImageInputDto)
  images?: ProductImageInputDto[];

  @ApiProperty({ type: () => [VariantGroupVariantInputDto] })
  @Label('Danh sách biến thể trong nhóm màu')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantGroupVariantInputDto)
  variants: VariantGroupVariantInputDto[];
}
