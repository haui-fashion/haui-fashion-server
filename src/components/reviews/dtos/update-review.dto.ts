import { ReviewImageInputDto } from '@components/reviews/dtos/create-review.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class UpdateReviewDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @Label('Số sao đánh giá')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  star?: number;

  @ApiPropertyOptional()
  @Label('Nội dung đánh giá')
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    type: () => ReviewImageInputDto,
    description: 'Hỗ trợ cả fileId và file dto (id/url/fileName).'
  })
  @Label('Ảnh đánh giá')
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewImageInputDto)
  image?: ReviewImageInputDto;
}
