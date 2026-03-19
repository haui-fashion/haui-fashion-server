import { Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class GeminiProductDescriptionImageDto {
  @IsOptional()
  @ValidateIf((o: GeminiProductDescriptionImageDto) => !o.url)
  @IsBase64()
  base64?: string;

  @IsOptional()
  @ValidateIf((o: GeminiProductDescriptionImageDto) => !o.base64)
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @ValidateIf((o: GeminiProductDescriptionImageDto) => !!o.base64)
  @IsString()
  @IsNotEmpty()
  mimeType?: string;
}

export class GeminiGenerateProductDescriptionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  styleTags?: string[];

  @IsOptional()
  @IsString()
  material?: string;

  @IsOptional()
  @IsString()
  season?: string;

  @IsOptional()
  @IsString()
  fit?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeminiProductDescriptionImageDto)
  images?: GeminiProductDescriptionImageDto[];
}
