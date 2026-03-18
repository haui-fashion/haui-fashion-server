import { BaseQueryDto } from '@common/dtos/base-query.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class QueryOrderDto extends BaseQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @Label('Trạng thái đơn hàng')
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional()
  @Label('ID người dùng')
  @IsOptional()
  @IsUUID()
  userId?: string;
}
