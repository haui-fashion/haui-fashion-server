import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @Label('Số sao đánh giá')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  star?: number;

  @ApiPropertyOptional()
  @Label('Nội dung đánh giá')
  @IsOptional()
  @IsString()
  content?: string;
}
