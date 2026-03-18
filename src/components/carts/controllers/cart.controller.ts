import { AddCartItemDto } from '@components/carts/dtos/add-cart-item.dto';
import { SyncCartDto } from '@components/carts/dtos/sync-cart.dto';
import { CartService } from '@components/carts/services/cart.service';
import { CurrentUser, CurrentUserDto } from '@core/utilities/decorators';
import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Carts')
@ApiBearerAuth()
@Controller({ path: 'carts', version: '1' })
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user cart' })
  async getMyCart(@CurrentUser() user: CurrentUserDto) {
    return this.cartService.getMyCart(user.userId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Add variant to cart (increase qty if exists)' })
  async addItem(
    @CurrentUser() user: CurrentUserDto,
    @Body() dto: AddCartItemDto
  ) {
    return this.cartService.addItem(user.userId, dto);
  }

  @Put('items')
  @ApiOperation({
    summary: 'Sync cart items'
  })
  syncCart(@CurrentUser() user: CurrentUserDto, @Body() dto: SyncCartDto) {
    return this.cartService.syncCart(user.userId, dto);
  }
}
