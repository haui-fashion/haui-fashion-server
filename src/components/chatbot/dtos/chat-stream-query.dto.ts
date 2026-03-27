import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength
} from 'class-validator';

export class ChatStreamQueryDto {
  @ApiProperty({
    description: 'Tin nhắn'
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({
    description: 'ID conversation'
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Session key'
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Trace ID'
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  traceId?: string;
}
