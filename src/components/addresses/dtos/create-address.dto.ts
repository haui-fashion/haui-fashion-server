import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class CreateAddressDto {
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @IsNotEmpty()
  @IsString()
  phone: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  provinceId?: number;

  @IsNotEmpty()
  @IsString()
  provinceName: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  districtId?: number;

  @IsNotEmpty()
  @IsString()
  districtName: string;

  @IsOptional()
  @IsString()
  wardCode?: string;

  @IsNotEmpty()
  @IsString()
  wardName: string;

  @IsNotEmpty()
  @IsString()
  street: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
