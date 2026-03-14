import { Label } from '@core/utilities/decorators/label.decorator';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

function parseQueryValue<T>(value: unknown): T {
  if (value == null) {
    return value as T;
  }

  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
}

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

export enum FilterOperator {
  EQ = 'eq',
  CONTAINS = 'contains',
  GT = 'gt',
  LT = 'lt',
  IN = 'in',
  BETWEEN = 'between'
}

export enum FilterValueType {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  DATE = 'date'
}

export class FilterDto {
  @Label('Cột lọc')
  @IsString()
  column: string;

  @Label('Toán tử lọc')
  @IsOptional()
  @IsEnum(FilterOperator)
  operator?: FilterOperator = FilterOperator.EQ;

  @Label('Kiểu dữ liệu lọc')
  @IsOptional()
  @IsEnum(FilterValueType)
  type?: FilterValueType = FilterValueType.STRING;

  @Label('Giá trị lọc')
  @IsOptional()
  value?: unknown;

  @Label('Danh sách giá trị lọc')
  @IsOptional()
  @IsArray()
  values?: unknown[];
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
  @Transform(({ value }) => {
    const parsed = parseQueryValue<PaginationDto | undefined>(value);
    return parsed ? plainToInstance(PaginationDto, parsed) : undefined;
  })
  pagination?: PaginationDto;

  @Label('Sắp xếp')
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SortDto)
  @Transform(({ value }) => {
    const parsed = parseQueryValue<SortDto[] | undefined>(value);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    return parsed.map((e) => plainToInstance(SortDto, e));
  })
  sort?: SortDto[];

  @Label('Bộ lọc')
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FilterDto)
  @Transform(({ value }) => {
    const parsed = parseQueryValue<FilterDto[] | undefined>(value);
    if (!Array.isArray(parsed)) {
      return undefined;
    }

    return parsed.map((e) => plainToInstance(FilterDto, e));
  })
  filter?: FilterDto[];

  @Label('Tìm kiếm')
  @IsOptional()
  @IsString()
  search?: string;
}
