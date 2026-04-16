import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty()
  @Label('ID sản phẩm')
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Label('Số sao đánh giá')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  star: number;

  @ApiPropertyOptional()
  @Label('Nội dung đánh giá')
  @IsOptional()
  @IsString()
  content?: string;
}
