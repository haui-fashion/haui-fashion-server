import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Gender } from '@prisma/client';
import { Expose } from 'class-transformer';

export class ProductEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  slug: string;

  @Expose()
  @ApiProperty()
  name: string;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  description?: Record<string, unknown>;

  @Expose()
  @ApiProperty({ required: false })
  descriptionHtml?: string;

  @Expose()
  @ApiProperty({ required: false })
  shortDescription?: string;

  @Expose()
  @ApiProperty({ required: false })
  brand?: string;

  @Expose()
  @ApiProperty({ enum: Gender, required: false })
  gender?: Gender;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  styleTags?: unknown;

  @Expose()
  @ApiProperty({ required: false })
  material?: string;

  @Expose()
  @ApiProperty({ required: false })
  season?: string;

  @Expose()
  @ApiProperty({ required: false })
  fit?: string;

  @Expose()
  @ApiProperty()
  isActive: boolean;

  @Expose()
  @ApiProperty({ required: false })
  categoryId?: string;

  @Expose()
  @ApiProperty({ required: false, type: Object })
  category?: Record<string, unknown>;

  @Expose()
  @ApiProperty({ required: false, type: [Object] })
  images?: Record<string, unknown>[];

  @Expose()
  @ApiProperty({ required: false, type: [Object] })
  variants?: Record<string, unknown>[];
}
