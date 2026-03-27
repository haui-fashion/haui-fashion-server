import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class CheckoutOrderItemDto {
  @ApiProperty()
  @Label('ID cart item')
  @IsNotEmpty()
  @IsUUID()
  cartItemId: string;
}
