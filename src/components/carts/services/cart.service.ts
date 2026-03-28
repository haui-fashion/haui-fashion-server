import { AddCartItemDto } from '@components/carts/dtos/add-cart-item.dto';
import { SyncCartDto } from '@components/carts/dtos/sync-cart.dto';
import { CartRepository } from '@components/carts/repositories/cart.repository';
import { PrismaService } from '@core/modules/prisma';
import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly prisma: PrismaService
  ) {}

  async getMyCart(userId: string) {
    const cart = await this.ensureCartByUserId(userId);
    return this.toCartSummary(cart);
  }

  async ensureCartByUserId(userId: string) {
    const existed = await this.cartRepository.findByUserId(userId);
    if (existed) {
      return existed;
    }

    await this.cartRepository.createForUser(userId);

    const created = await this.cartRepository.findByUserId(userId);
    if (!created) {
      throw new NotFoundException('Không thể khởi tạo giỏ hàng cho người dùng');
    }

    return created;
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const cart = await this.ensureCartByUserId(userId);
    const quantity = dto.quantity ?? 1;

    const variant = await this.prisma.variant.findUnique({
      where: {
        id: dto.variantId
      },
      include: {
        product: true
      }
    });

    if (!variant) {
      throw new NotFoundException(
        `Không tìm thấy biến thể với id ${dto.variantId}`
      );
    }

    if (!variant.product.isActive) {
      throw new ConflictException('Sản phẩm đã ngừng bán hoặc bị vô hiệu hóa');
    }

    if (variant.stock < quantity) {
      throw new ConflictException(
        'Số lượng thêm vào vượt quá tồn kho hiện tại'
      );
    }

    const existingItem = await this.cartRepository.findItemByCartAndVariant(
      cart.id,
      dto.variantId
    );

    if (existingItem) {
      const nextQuantity = existingItem.quantity + quantity;
      if (nextQuantity > variant.stock) {
        throw new ConflictException(
          'Số lượng trong giỏ vượt quá tồn kho hiện tại'
        );
      }

      await this.cartRepository.updateItemQuantity(
        existingItem.id,
        nextQuantity
      );
    } else {
      await this.cartRepository.createItem({
        cart: {
          connect: {
            id: cart.id
          }
        },
        variant: {
          connect: {
            id: dto.variantId
          }
        },
        quantity
      });
    }

    return this.getMyCart(userId);
  }

  async syncCart(userId: string, dto: SyncCartDto) {
    const cart = await this.ensureCartByUserId(userId);

    const items = dto.items ?? [];
    const variantIds = items.map((item) => item.variantId);
    const duplicateCount = variantIds.length - new Set(variantIds).size;
    if (duplicateCount > 0) {
      throw new ConflictException('Danh sách giỏ hàng chứa biến thể bị trùng');
    }

    if (variantIds.length === 0) {
      await this.cartRepository.clearItemsByCartId(cart.id);
      return this.getMyCart(userId);
    }

    const variants = await this.prisma.variant.findMany({
      where: {
        id: {
          in: variantIds
        }
      },
      select: {
        id: true,
        sku: true,
        stock: true,
        product: {
          select: {
            isActive: true
          }
        }
      }
    });

    if (variants.length !== variantIds.length) {
      const existedVariantIds = new Set(variants.map((variant) => variant.id));
      const missingVariantId = variantIds.find(
        (id) => !existedVariantIds.has(id)
      );
      throw new NotFoundException(
        `Không tìm thấy biến thể với id ${missingVariantId}`
      );
    }

    const variantMap = new Map(
      variants.map((variant) => [variant.id, variant])
    );

    items.forEach((item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant) {
        return;
      }

      if (variant.stock < item.quantity) {
        throw new ConflictException(
          `Biến thể ${variant.sku} có tồn kho không đủ cho số lượng ${item.quantity}`
        );
      }

      if (!variant.product.isActive) {
        throw new ConflictException(
          `Biến thể ${variant.sku} thuộc sản phẩm đã ngừng bán hoặc bị vô hiệu hóa`
        );
      }
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id
        }
      });

      await tx.cartItem.createMany({
        data: items.map((item) => ({
          cartId: cart.id,
          variantId: item.variantId,
          quantity: item.quantity
        }))
      });
    });

    return this.getMyCart(userId);
  }

  private toCartSummary(
    cart: Awaited<ReturnType<CartService['ensureCartByUserId']>>
  ) {
    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    const totalAmount = cart.items.reduce(
      (sum, item) =>
        sum.plus(new Prisma.Decimal(item.variant.price).mul(item.quantity)),
      new Prisma.Decimal(0)
    );

    return {
      ...cart,
      totalItems,
      totalAmount: totalAmount.toFixed(2),
      items: cart.items.map((item) => {
        const unitPrice = new Prisma.Decimal(item.variant.price);
        const variantImages = item.variant.colorOptionValue?.images ?? [];
        const productImages = item.variant.product?.images ?? [];

        return {
          ...item,
          variant: {
            ...item.variant,
            size: item.variant.sizeOptionValue?.value ?? '',
            color: item.variant.colorOptionValue?.value ?? '',
            hexColor: item.variant.colorOptionValue?.hexColor ?? null,
            images: variantImages,
            product: {
              ...item.variant.product,
              images: productImages
            }
          },
          lineAmount: unitPrice.mul(item.quantity).toFixed(2)
        };
      })
    };
  }
}
