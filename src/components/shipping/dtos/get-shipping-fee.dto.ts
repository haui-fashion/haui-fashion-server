import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString } from 'class-validator';

export class GetShippingFeeDto {
  @ApiProperty()
  @IsNumber()
  insuranceValue: number;

  @ApiProperty()
  @IsString()
  toWardCode: string;

  @ApiProperty()
  @IsString()
  toDistrictId: string;
}
