import { CartItemDatasource } from '@components/carts/datasources/cart-item.datasource';
import { CartDatasource } from '@components/carts/datasources/cart.datasource';
import { CartEntity } from '@components/carts/entities/cart.entity';
import { BaseRepository } from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Cart, CartItem, Prisma } from '@prisma/client';

const cartItemInclude = Prisma.validator<Prisma.CartItemInclude>()({
  variant: {
    include: {
      product: {
        include: {
          images: {
            include: {
              file: true
            },
            orderBy: [
              { isPrimary: 'desc' },
              { position: 'asc' },
              { createdAt: 'asc' }
            ]
          }
        }
      },
      sizeOptionValue: true,
      colorOptionValue: {
        include: {
          images: {
            include: {
              file: true
            },
            orderBy: [
              { isPrimary: 'desc' },
              { position: 'asc' },
              { createdAt: 'asc' }
            ]
          }
        }
      }
    }
  }
});

type CartWithItems = Prisma.CartGetPayload<{
  include: {
    items: {
      include: typeof cartItemInclude;
    };
  };
}>;

type CartItemWithVariant = Prisma.CartItemGetPayload<{
  include: {
    cart: true;
    variant: {
      include: typeof cartItemInclude.variant.include;
    };
  };
}>;

@Injectable()
export class CartRepository extends BaseRepository<CartEntity, Cart> {
  constructor(
    private readonly cartDatasource: CartDatasource,
    private readonly cartItemDatasource: CartItemDatasource
  ) {
    super(CartEntity);
  }

  async findByUserId(userId: string): Promise<CartWithItems | null> {
    return this.cartDatasource.findOneByCondition(
      { userId } as Prisma.CartWhereInput,
      {
        include: {
          items: {
            include: cartItemInclude
          }
        }
      }
    ) as Promise<CartWithItems | null>;
  }

  async createForUser(userId: string): Promise<Cart> {
    return this.cartDatasource.create({
      user: {
        connect: {
          id: userId
        }
      }
    });
  }

  async findItemByCartAndVariant(
    cartId: string,
    variantId: string
  ): Promise<CartItem | null> {
    return this.cartItemDatasource.findOneByCondition({
      cartId,
      variantId
    } as Prisma.CartItemWhereInput);
  }

  async findItemById(itemId: string): Promise<CartItemWithVariant | null> {
    return this.cartItemDatasource.findById(itemId, {
      include: {
        cart: true,
        variant: {
          include: cartItemInclude.variant.include
        }
      }
    }) as Promise<CartItemWithVariant | null>;
  }

  async createItem(data: Prisma.CartItemCreateInput): Promise<CartItem> {
    return this.cartItemDatasource.create(data);
  }

  async updateItemQuantity(
    itemId: string,
    quantity: number
  ): Promise<CartItem> {
    return this.cartItemDatasource.updateById(itemId, { quantity });
  }

  async removeItem(itemId: string): Promise<CartItem> {
    return this.cartItemDatasource.deleteById(itemId);
  }

  async clearItemsByCartId(cartId: string): Promise<void> {
    await this.cartItemDatasource.deleteManyByCondition({
      cartId
    } as Prisma.CartItemWhereInput);
  }
}
