import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @Label('Token đặt lại mật khẩu')
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @Label('Mã bí mật đặt lại mật khẩu')
  @IsString()
  @IsNotEmpty()
  secret: string;

  @ApiProperty()
  @Label('Mật khẩu mới')
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword: string;
}
