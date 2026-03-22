import { FileDto } from '@common/dtos/file.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class VariantImageInputDto {
  @ApiPropertyOptional()
  @Label('ID tệp đã tải lên')
  @IsOptional()
  @ValidateIf((o: VariantImageInputDto) => !o.file)
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional({ type: () => FileDto })
  @Label('Thông tin tệp')
  @IsOptional()
  @ValidateIf((o: VariantImageInputDto) => !o.fileId)
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

export class CreateVariantDto {
  @ApiProperty()
  @Label('ID sản phẩm')
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @Label('Kích cỡ')
  @IsNotEmpty()
  @IsString()
  size: string;

  @ApiProperty()
  @Label('Màu sắc')
  @IsNotEmpty()
  @IsString()
  color: string;

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

  @ApiPropertyOptional({
    type: () => [VariantImageInputDto],
    description: 'Hỗ trợ cả fileId và file dto (id/url/fileName).'
  })
  @Label('Danh sách ảnh biến thể')
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantImageInputDto)
  images?: VariantImageInputDto[];
}
