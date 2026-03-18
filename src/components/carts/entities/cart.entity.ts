import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class CartEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty({ type: [Object], required: false })
  items?: Record<string, unknown>[];

  @Expose()
  @ApiProperty({ type: String })
  totalAmount?: string;

  @Expose()
  @ApiProperty({ type: Number })
  totalItems?: number;
}
