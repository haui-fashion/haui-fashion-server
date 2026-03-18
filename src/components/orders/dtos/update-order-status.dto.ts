import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @Label('Trạng thái đơn hàng')
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentStatus })
  @Label('Trạng thái thanh toán')
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
