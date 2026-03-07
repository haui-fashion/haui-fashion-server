import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export enum SortParam {
  ASC = 'asc',
  DESC = 'desc'
}

export class FilterDto {
  @IsString()
  column: string;

  @IsString()
  value: string;
}

export class SortDto {
  @IsString()
  column: string;

  @IsEnum(SortParam)
  value: SortParam = SortParam.DESC;
}

export class BaseQueryDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination?: PaginationDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  sort?: SortDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filter?: FilterDto[];

  @IsOptional()
  @IsString()
  search?: string;
}
