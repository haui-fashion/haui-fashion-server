import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min
} from 'class-validator';

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
}
