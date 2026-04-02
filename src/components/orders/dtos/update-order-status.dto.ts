import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf
} from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Lý do hủy đơn. Bắt buộc khi chuyển trạng thái sang CANCELED.'
  })
  @Label('Lý do hủy đơn')
  @ValidateIf((o: UpdateOrderStatusDto) => o.status === OrderStatus.CANCELED)
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  cancelReason?: string;
}
