import { Label } from '@core/utilities/decorators/label.decorator';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsDateString
} from 'class-validator';
import { Gender } from '@prisma/client';

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

  @Label('Số điện thoại')
  @IsOptional()
  @IsString()
  phone?: string;

  @Label('Ngày sinh')
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Label('Giới tính')
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Label('Đã xác minh email')
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}
