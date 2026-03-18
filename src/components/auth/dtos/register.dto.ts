import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @Label('Họ và tên')
  @IsString()
  @IsNotEmpty()
  fullname: string;

  @ApiProperty()
  @Label('Email')
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @Label('Mật khẩu')
  @IsString()
  @MinLength(6)
  password: string;
}
