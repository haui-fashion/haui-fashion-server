import { BaseQueryDto } from '@common/dtos/base-query.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class QueryReviewDto extends BaseQueryDto {
  @ApiPropertyOptional()
  @Label('ID sản phẩm')
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @Label('ID người dùng')
  @IsOptional()
  @IsUUID()
  userId?: string;
}
