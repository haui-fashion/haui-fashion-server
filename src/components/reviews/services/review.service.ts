import {
  REVIEW_CREATED_EVENT,
  ReviewCreatedEventPayload
} from '@components/reviews/constants/review.constant';
import {
  CreateReviewDto,
  ReviewImageInputDto
} from '@components/reviews/dtos/create-review.dto';
import { QueryReviewDto } from '@components/reviews/dtos/query-review.dto';
import { UpdateReviewDto } from '@components/reviews/dtos/update-review.dto';
import { ReviewRepository } from '@components/reviews/repositories/review.repository';
import { PrismaService } from '@core/modules/prisma';
import { CurrentUserDto } from '@core/utilities/decorators';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, Role } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async findAll(query: QueryReviewDto) {
    return this.reviewRepository.findAll(query);
  }

  async findById(id: string) {
    const review = await this.reviewRepository.findById(id);
    if (!review) {
      throw new NotFoundException(`Không tìm thấy đánh giá với id ${id}`);
    }

    return review;
  }

  async create(user: CurrentUserDto, dto: CreateReviewDto) {
    await this.assertUserExists(user.userId);
    await this.assertProductExists(dto.productId);
    const imageId = this.normalizeImageInput(dto.image);
    await this.assertImageExists(imageId);

    const existing = await this.reviewRepository.findByUserAndProduct(
      user.userId,
      dto.productId
    );

    if (existing) {
      throw new ConflictException(
        'Bạn đã đánh giá sản phẩm này. Mỗi người dùng chỉ được tạo một đánh giá cho mỗi sản phẩm.'
      );
    }

    const data: Prisma.ReviewCreateInput = {
      star: dto.star,
      content: dto.content,
      user: {
        connect: {
          id: user.userId
        }
      },
      product: {
        connect: {
          id: dto.productId
        }
      },
      ...(imageId && {
        image: {
          connect: {
            id: imageId
          }
        }
      })
    };

    try {
      const created = await this.reviewRepository.createReview(data);

      const payload: ReviewCreatedEventPayload = {
        id: created.id,
        userId: created.userId,
        productId: created.productId,
        star: created.star,
        content: created.content,
        imageId: created.imageId,
        createdAt: created.createdAt
      };

      this.eventEmitter.emit(REVIEW_CREATED_EVENT, payload);

      return created;
    } catch (error) {
      if (this.isUniqueConstraintError(error, ['userId', 'productId'])) {
        throw new ConflictException(
          'Bạn đã đánh giá sản phẩm này. Mỗi người dùng chỉ được tạo một đánh giá cho mỗi sản phẩm.'
        );
      }
      throw error;
    }
  }

  async update(id: string, user: CurrentUserDto, dto: UpdateReviewDto) {
    const review = await this.findById(id);
    this.assertCanMutate(review.userId, user);

    const imageId = this.normalizeImageInput(dto.image);
    await this.assertImageExists(imageId);

    const data: Prisma.ReviewUpdateInput = {
      star: dto.star,
      content: dto.content,
      ...(imageId && {
        image: {
          connect: {
            id: imageId
          }
        }
      })
    };

    return this.reviewRepository.updateReview(id, data);
  }

  async remove(id: string, user: CurrentUserDto) {
    const review = await this.findById(id);
    this.assertCanMutate(review.userId, user);

    return this.reviewRepository.deleteReview(id);
  }

  private assertCanMutate(ownerId: string, user: CurrentUserDto) {
    if (user.role === Role.ADMIN) {
      return;
    }

    if (ownerId !== user.userId) {
      throw new ForbiddenException(
        'Bạn không có quyền chỉnh sửa hoặc xóa đánh giá này'
      );
    }
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      throw new NotFoundException(`Không tìm thấy người dùng với id ${userId}`);
    }
  }

  private async assertProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true }
    });

    if (!product) {
      throw new NotFoundException(
        `Không tìm thấy sản phẩm với id ${productId}`
      );
    }
  }

  private async assertImageExists(imageId?: string) {
    if (!imageId) {
      return;
    }

    const file = await this.prisma.file.findUnique({
      where: { id: imageId },
      select: { id: true }
    });

    if (!file) {
      throw new NotFoundException(`Không tìm thấy file với id ${imageId}`);
    }
  }

  private normalizeImageInput(image?: ReviewImageInputDto): string | undefined {
    if (!image) {
      return undefined;
    }

    const fileId = image.fileId || image.file?.id;

    if (!fileId) {
      throw new BadRequestException('Ảnh đánh giá phải có fileId hoặc file.id');
    }

    return fileId;
  }

  private isUniqueConstraintError(error: unknown, fields: string[]): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    if (Array.isArray(target)) {
      return fields.some((field) =>
        target.some(
          (targetField) =>
            String(targetField).includes(field) ||
            String(targetField).includes(this.toSnakeCase(field))
        )
      );
    }

    if (typeof target === 'string') {
      return fields.some(
        (field) =>
          target.includes(field) || target.includes(this.toSnakeCase(field))
      );
    }

    return false;
  }

  private toSnakeCase(value: string): string {
    return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  }
}
