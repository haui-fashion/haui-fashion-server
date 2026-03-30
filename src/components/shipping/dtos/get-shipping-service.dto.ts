import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class GetShippingServiceDto {
  @ApiProperty()
  @IsString()
  toDistrictId: string;
}
