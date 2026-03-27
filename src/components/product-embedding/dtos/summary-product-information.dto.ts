import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class SummaryProductInformationDto {
  @IsString()
  name: string;

  @IsString()
  categoryName: string;

  @IsString()
  gender: string;

  @IsArray()
  @IsString({ each: true })
  colors: string[];

  @IsArray()
  @IsString({ each: true })
  sizes: string[];

  @IsArray()
  @IsString({ each: true })
  styleTags: string[];

  @IsString()
  material: string;

  @IsString()
  fit: string;

  @IsString()
  season: string;

  @IsString()
  descriptionHtml: string;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
