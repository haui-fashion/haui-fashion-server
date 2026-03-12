import { Label } from '@core/utilities/decorators/label.decorator';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength
} from 'class-validator';

export enum Role {
  CUSTOMER = 'CUSTOMER',
  ADMIN = 'ADMIN'
}

export class CreateUserDto {
  @Label('Tên đăng nhập')
  @IsNotEmpty()
  @IsString()
  username: string;

  @Label('Họ và tên')
  @IsNotEmpty()
  @IsString()
  fullname: string;

  @Label('Tên hiển thị')
  @IsOptional()
  @IsString()
  name?: string;

  @Label('Email')
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @Label('Mật khẩu')
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;

  @Label('Vai trò')
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
