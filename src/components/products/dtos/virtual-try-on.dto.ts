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
  productName: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  garmentType?: string;
}
