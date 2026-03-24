import { BaseQueryDto } from '@common/dtos/base-query.dto';
import { IsOptional, IsString } from 'class-validator';

export class QueryProductDto extends BaseQueryDto {
  @IsOptional()
  @IsString()
  categorySlug?: string;
}
