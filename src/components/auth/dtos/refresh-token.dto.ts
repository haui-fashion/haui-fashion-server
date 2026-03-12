import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty()
  @Label('Refresh token')
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
