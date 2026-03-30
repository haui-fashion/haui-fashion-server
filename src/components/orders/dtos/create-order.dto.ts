import { CheckoutOrderItemDto } from '@components/orders/dtos/checkout-order-item.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested
} from 'class-validator';

export class CreateOrderDto {
  @ApiProperty()
  @Label('ID địa chỉ giao hàng')
  @IsNotEmpty()
  @IsUUID()
  addressId: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.COD })
  @Label('Phương thức thanh toán')
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ type: [CheckoutOrderItemDto] })
  @Label('Danh sách sản phẩm thanh toán')
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CheckoutOrderItemDto)
  items?: CheckoutOrderItemDto[];

  @ApiPropertyOptional({
    type: Number,
    description: 'ID dịch vụ vận chuyển GHN'
  })
  @Label('ID dịch vụ vận chuyển')
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  serviceId?: number;

  @ApiPropertyOptional({ type: Number, description: 'Service type ID GHN' })
  @Label('Service type ID vận chuyển')
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceTypeId?: number;
}
