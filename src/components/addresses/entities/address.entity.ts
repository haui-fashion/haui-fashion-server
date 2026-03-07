import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AddressEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  fullName: string;

  @Expose()
  @ApiProperty()
  phone: string;

  @Expose()
  @ApiProperty({ required: false })
  provinceId?: number;

  @Expose()
  @ApiProperty()
  provinceName: string;

  @Expose()
  @ApiProperty({ required: false })
  districtId?: number;

  @Expose()
  @ApiProperty()
  districtName: string;

  @Expose()
  @ApiProperty({ required: false })
  wardCode?: string;

  @Expose()
  @ApiProperty()
  wardName: string;

  @Expose()
  @ApiProperty()
  street: string;

  @Expose()
  @ApiProperty()
  isDefault: boolean;

  @Expose()
  @ApiProperty()
  userId: string;
}
