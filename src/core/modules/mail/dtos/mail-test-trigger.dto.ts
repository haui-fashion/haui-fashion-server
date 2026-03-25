import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class MailTestTriggerDto {
  @ApiProperty({
    example: 'delivered@resend.dev'
  })
  @Label('Email nhận test')
  @IsEmail()
  to: string;

  @ApiPropertyOptional({
    example: 'HAUI Fashion User'
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000'
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({
    example: 'welcome'
  })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiPropertyOptional({
    example: 'Welcome to HAUI Fashion'
  })
  @IsOptional()
  @IsString()
  subject?: string;
}
