import { Label } from '@core/utilities/decorators/label.decorator';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min
} from 'class-validator';

export class CreateCategoryDto {
  @Label('Tên danh mục')
  @IsNotEmpty()
  @IsString()
  name: string;

  @Label('Slug')
  @IsOptional()
  @IsString()
  slug?: string;

  @Label('Mô tả')
  @IsOptional()
  @IsString()
  description?: string;

  @Label('Kích hoạt')
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Label('Thứ tự hiển thị')
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @Label('Danh mục cha')
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
