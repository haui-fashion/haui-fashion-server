import { VirtualTryOnDto } from '@components/products/dtos/virtual-try-on.dto';
import { GeminiImageService } from '@core/modules/gemini/services/gemini-image.service';
import { PrismaService } from '@core/modules/prisma';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common';

@Injectable()
export class VirtualTryOnService {
  private readonly logger = new Logger(VirtualTryOnService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiImageService: GeminiImageService
  ) {}

  async tryOn(dto: VirtualTryOnDto, userImage: Express.Multer.File) {
    const productImage = await this.prisma.productImage.findUnique({
      where: { id: dto.productImageId },
      include: {
        file: { select: { url: true, mimetype: true } },
        product: { select: { id: true, name: true } }
      }
    });

    if (!productImage) {
      throw new NotFoundException(
        `Không tìm thấy ảnh sản phẩm với id ${dto.productImageId}`
      );
    }

    const clothingBase64 = await this.downloadImageAsBase64(
      productImage.file.url
    );
    const clothingMimeType = productImage.file.mimetype || 'image/jpeg';

    if (!userImage || !userImage.buffer?.length) {
      throw new BadRequestException('Không tìm thấy ảnh người dùng để thử đồ.');
    }

    if (!userImage.mimetype?.startsWith('image/')) {
      throw new BadRequestException('File tải lên phải là ảnh hợp lệ.');
    }

    const userMimeType = userImage.mimetype || 'image/jpeg';
    const userImageBase64 = this.convertBufferToBase64(userImage.buffer);
    const productName = dto.productName?.trim() || productImage.product.name;

    this.logger.log(
      `VTON request: product="${productName}", garmentType="${dto.garmentType || 'auto'}"`
    );

    const result = await this.geminiImageService.virtualTryOn(
      clothingBase64,
      clothingMimeType,
      userImageBase64,
      userMimeType,
      dto.garmentType,
      productName
    );

    return {
      base64: result.base64,
      mimeType: result.mimeType,
      productId: productImage.product.id,
      productName: productImage.product.name
    };
  }

  private convertBufferToBase64(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  private async downloadImageAsBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } catch (error) {
      this.logger.error(
        `Failed to download product image from ${url}`,
        error instanceof Error ? error.stack : error
      );
      throw new BadRequestException(
        'Không thể tải ảnh sản phẩm. Vui lòng thử lại.'
      );
    }
  }
}
