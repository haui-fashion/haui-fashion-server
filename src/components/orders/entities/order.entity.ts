import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class OrderEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty()
  status: string;

  @Expose()
  @ApiProperty({ type: String })
  totalAmount: string;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  userSnapshot: Record<string, unknown>;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  shippingAddress: Record<string, unknown>;

  @Expose()
  @ApiProperty({ type: [Object], required: false })
  items?: Record<string, unknown>[];

  @Expose()
  @ApiProperty({ required: false, type: Object })
  payment?: Record<string, unknown> | null;
}
