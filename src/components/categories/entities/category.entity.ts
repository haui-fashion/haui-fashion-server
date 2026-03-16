import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class CategoryEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty()
  slug: string;

  @Expose()
  @ApiProperty({ required: false })
  description?: string;

  @Expose()
  @ApiProperty()
  isActive: boolean;

  @Expose()
  @ApiProperty()
  position: number;

  @Expose()
  @ApiProperty({ required: false })
  parentId?: string;

  @Expose()
  @ApiProperty({ type: () => [CategoryEntity], required: false })
  @Type(() => CategoryEntity)
  children?: CategoryEntity[];
}
