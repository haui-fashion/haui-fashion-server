import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class VariantEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  productId: string;

  @Expose()
  @ApiProperty()
  size: string;

  @Expose()
  @ApiProperty()
  color: string;

  @Expose()
  @ApiProperty({ required: false })
  hexColor?: string;

  @Expose()
  @ApiProperty()
  sku: string;

  @Expose()
  @ApiProperty()
  price: string | number;

  @Expose()
  @ApiProperty()
  stock: number;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  product?: Record<string, unknown>;

  @Expose()
  @ApiProperty({ required: false, type: [Object] })
  images?: Record<string, unknown>[];
}
