import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class GetShippingFeeDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  insuranceValue: number;

  @ApiProperty()
  @IsString()
  toWardCode: string;

  @ApiProperty()
  @IsString()
  toDistrictId: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  codValue: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  serviceTypeId: number;

  @ApiProperty()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  serviceId: number;
}
