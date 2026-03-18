import { CreateOrderDto } from '@components/orders/dtos/create-order.dto';
import { QueryOrderDto } from '@components/orders/dtos/query-order.dto';
import { UpdateOrderStatusDto } from '@components/orders/dtos/update-order-status.dto';
import { OrderService } from '@components/orders/services/order.service';
import { CurrentUser, CurrentUserDto } from '@core/utilities/decorators';
import { Roles } from '@core/utilities/decorators/roles.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create an order from current cart' })
  async checkout(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateOrderDto
  ) {
    return this.orderService.createFromMyCart(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user orders' })
  async findMyOrders(@CurrentUser() user: CurrentUserDto) {
    return this.orderService.findMyOrders(user.userId);
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin list orders with pagination and filters' })
  async findAllForAdmin(@Query() query: QueryOrderDto) {
    return this.orderService.findAllForAdmin(query);
  }

  @Get('admin/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin get one order by id' })
  async findByIdForAdmin(@Param('id') id: string) {
    return this.orderService.findByIdForAdmin(id);
  }

  @Patch('admin/:id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin update order status' })
  async updateStatusForAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.orderService.updateStatusForAdmin(id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one current user order by id' })
  async findMyOrderById(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string
  ) {
    return this.orderService.findMyOrderById(id, user.userId);
  }
}
