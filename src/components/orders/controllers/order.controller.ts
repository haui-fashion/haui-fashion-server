import { CreateOrderDto } from '@components/orders/dtos/create-order.dto';
import { PreviewOrderDto } from '@components/orders/dtos/preview-order.dto';
import { QueryOrderDto } from '@components/orders/dtos/query-order.dto';
import { UpdateOrderStatusDto } from '@components/orders/dtos/update-order-status.dto';
import { OrderService } from '@components/orders/services/order.service';
import {
  CurrentUser,
  CurrentUserDto,
  Public
} from '@core/utilities/decorators';
import { Roles } from '@core/utilities/decorators/roles.decorator';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Record } from '@prisma/client/runtime/library';
import { Request } from 'express';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller({ path: 'orders', version: '1' })
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post('checkout')
  @ApiOperation({ summary: 'Create an order from current cart' })
  async checkout(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: CreateOrderDto,
    @Req() req: Request
  ) {
    const ipAddr =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    return this.orderService.createFromMyCart(user.userId, dto, ipAddr);
  }

  @Post('preview')
  @ApiOperation({ summary: 'Preview checkout totals before placing order' })
  async preview(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: PreviewOrderDto
  ) {
    return this.orderService.previewOrder(user.userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user orders' })
  async findMyOrders(
    @CurrentUser() user: CurrentUserDto,
    @Query() query: QueryOrderDto
  ) {
    return this.orderService.findMyOrders(user.userId, query);
  }

  @Public()
  @Get('vnpay-ipn')
  @ApiOperation({
    summary: 'VNPay IPN callback (server-to-server, no auth required)'
  })
  async vnpayIpn(@Query() query: Record<string, string>) {
    return this.orderService.handleVnpayIpn(query);
  }

  @Public()
  @Get('vnpay-return')
  @ApiOperation({
    summary: 'VNPay return URL handler (no auth required)'
  })
  vnpayReturn(@Query() query: Record<string, string>) {
    return this.orderService.handleVnpayReturn(query);
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

  @Post(':id/retry-vnpay')
  @ApiOperation({ summary: 'Retry VNPay payment for my pending order' })
  async retryVnpayPayment(
    @CurrentUser() user: CurrentUserDto,
    @Param('id') id: string,
    @Req() req: Request
  ) {
    const ipAddr =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    return await this.orderService.retryMyVnpayPayment(id, user.userId, ipAddr);
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
