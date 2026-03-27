import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VirtualTryOnDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productImageId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userImageBase64: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  userImageMimeType?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  garmentType?: string;
}
