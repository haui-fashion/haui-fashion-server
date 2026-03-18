import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @Label('ID biến thể')
  @IsNotEmpty()
  @IsUUID()
  variantId: string;

  @ApiPropertyOptional({ default: 1 })
  @Label('Số lượng')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;
}
