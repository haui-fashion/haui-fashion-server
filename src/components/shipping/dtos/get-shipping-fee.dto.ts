import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

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
}
