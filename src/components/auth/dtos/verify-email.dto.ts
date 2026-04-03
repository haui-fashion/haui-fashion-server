import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty()
  @Label('Token xác minh email')
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @Label('Mã bí mật xác minh email')
  @IsString()
  @IsNotEmpty()
  secret: string;
}
