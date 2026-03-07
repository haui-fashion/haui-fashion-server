import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class BaseEntity {
  @Expose()
  @ApiProperty()
  id?: string;

  @Expose()
  @ApiProperty()
  code?: string;

  @Expose()
  @ApiProperty()
  createdAt?: Date;

  @Expose()
  @ApiProperty()
  updatedAt?: Date;

  @Expose()
  @ApiProperty()
  deletedAt?: Date;
}
