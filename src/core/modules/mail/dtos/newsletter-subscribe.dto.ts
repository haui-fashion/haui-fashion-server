import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class NewsletterSubscribeDto {
  @ApiProperty({
    example: 'newsletter@hauifashion.com'
  })
  @IsEmail()
  email: string;
}
