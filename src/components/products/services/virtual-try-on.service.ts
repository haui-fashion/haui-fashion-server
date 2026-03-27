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

  async tryOn(dto: VirtualTryOnDto) {
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
    const userMimeType = dto.userImageMimeType || 'image/jpeg';

    this.logger.log(
      `VTON request: product="${productImage.product.name}", garmentType="${dto.garmentType || 'auto'}"`
    );

    const result = await this.geminiImageService.virtualTryOn(
      clothingBase64,
      clothingMimeType,
      dto.userImageBase64,
      userMimeType,
      dto.garmentType
    );

    return {
      base64: result.base64,
      mimeType: result.mimeType,
      productId: productImage.product.id,
      productName: productImage.product.name
    };
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
