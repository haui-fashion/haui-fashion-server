import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class FileEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  filename: string;

  @Expose()
  @ApiProperty()
  publicId: string;

  @Expose()
  @ApiProperty()
  url: string;

  @Expose()
  @ApiProperty()
  mimetype: string;

  @Expose()
  @ApiProperty()
  size: number;

  @Expose()
  @ApiProperty({ required: false })
  userId?: string;
}
