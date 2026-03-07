import { BaseEntity } from '@core/utilities/entities';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Exclude, Expose } from 'class-transformer';

export class UserEntity extends BaseEntity {
  @Expose()
  @ApiProperty()
  username: string;

  @Expose()
  @ApiProperty()
  name?: string;

  @Expose()
  @ApiProperty()
  fullname: string;

  @Expose()
  @ApiProperty()
  email: string;

  @Exclude()
  password?: string;

  @Expose()
  @ApiProperty({ enum: Role })
  role: Role;

  @Expose()
  @ApiProperty()
  isActive: boolean;
}
