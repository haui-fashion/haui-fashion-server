import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class GenerateProductDescriptionImageDto {
  @ApiPropertyOptional()
  @Label('Ảnh base64')
  @IsOptional()
  @ValidateIf((o: GenerateProductDescriptionImageDto) => !o.url)
  @IsBase64()
  base64?: string;

  @ApiPropertyOptional()
  @Label('URL ảnh')
  @IsOptional()
  @ValidateIf((o: GenerateProductDescriptionImageDto) => !o.base64)
  @IsUrl({ require_protocol: true })
  url?: string;

  @ApiPropertyOptional()
  @Label('MIME type ảnh')
  @IsOptional()
  @ValidateIf((o: GenerateProductDescriptionImageDto) => !!o.base64)
  @IsString()
  @IsNotEmpty()
  mimeType?: string;
}

export class GenerateProductDescriptionDto {
  @ApiProperty()
  @Label('Tên sản phẩm')
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @Label('Thương hiệu')
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ enum: Gender })
  @Label('Giới tính')
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @Label('Style tags')
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  styleTags?: string[];

  @ApiPropertyOptional()
  @Label('Chất liệu')
  @IsOptional()
  @IsString()
  material?: string;

  @ApiPropertyOptional()
  @Label('Mùa')
  @IsOptional()
  @IsString()
  season?: string;

  @ApiPropertyOptional()
  @Label('Form dáng')
  @IsOptional()
  @IsString()
  fit?: string;

  @ApiPropertyOptional()
  @Label('Tên danh mục')
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiPropertyOptional()
  @Label('Điểm nổi bật')
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional()
  @Label('Danh sách ảnh sản phẩm')
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GenerateProductDescriptionImageDto)
  images?: GenerateProductDescriptionImageDto[];
}
