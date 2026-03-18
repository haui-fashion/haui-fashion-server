import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';

export class SyncCartItemDto {
  @ApiProperty()
  @Label('ID biến thể')
  @IsNotEmpty()
  @IsUUID()
  variantId: string;

  @ApiProperty()
  @Label('Số lượng')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class SyncCartDto {
  @ApiProperty({ type: [SyncCartItemDto], default: [] })
  @Label('Danh sách sản phẩm giỏ hàng')
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncCartItemDto)
  items: SyncCartItemDto[];
}
