import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ReviewEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty()
  productId: string;

  @Expose()
  @ApiProperty({ minimum: 0, maximum: 5 })
  star: number;

  @Expose()
  @ApiProperty({ required: false })
  content?: string;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  user?: Record<string, unknown>;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  product?: Record<string, unknown>;
}
