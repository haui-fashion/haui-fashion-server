import { Label } from '@core/utilities/decorators/label.decorator';
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
  @Label('Trang')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Label('Số bản ghi')
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
  @Label('Cột lọc')
  @IsString()
  column: string;

  @Label('Giá trị lọc')
  @IsString()
  value: string;
}

export class SortDto {
  @Label('Cột sắp xếp')
  @IsString()
  column: string;

  @Label('Thứ tự sắp xếp')
  @IsEnum(SortParam)
  value: SortParam = SortParam.DESC;
}

export class BaseQueryDto {
  @Label('Phân trang')
  @IsOptional()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination?: PaginationDto;

  @Label('Sắp xếp')
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  sort?: SortDto[];

  @Label('Bộ lọc')
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  filter?: FilterDto[];

  @Label('Tìm kiếm')
  @IsOptional()
  @IsString()
  search?: string;
}
