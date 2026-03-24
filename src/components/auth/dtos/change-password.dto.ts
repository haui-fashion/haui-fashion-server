import { Label } from '@core/utilities/decorators/label.decorator';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @Label('Mật khẩu hiện tại')
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  oldPassword: string;

  @Label('Mật khẩu mới')
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  newPassword: string;
}
