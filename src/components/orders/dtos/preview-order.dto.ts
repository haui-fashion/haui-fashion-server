import { CheckoutOrderItemDto } from '@components/orders/dtos/checkout-order-item.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsUUID,
  ValidateNested
} from 'class-validator';

export class PreviewOrderDto {
  @ApiProperty()
  @Label('ID địa chỉ giao hàng')
  @IsNotEmpty()
  @IsUUID()
  addressId: string;

  @ApiProperty({ type: [CheckoutOrderItemDto] })
  @Label('Danh sách sản phẩm thanh toán')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items: CheckoutOrderItemDto[];
}
