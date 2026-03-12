import { CLOUDINARY } from '@core/modules/cloudinary/cloudinary.provider';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadApiErrorResponse, UploadApiResponse, v2 } from 'cloudinary';
import * as streamifier from 'streamifier';
import { FileRepository } from '../repositories/file.repository';

export interface FileUploadResult {
  id: string;
  url: string;
  publicId: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class FilesService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof v2,
    private readonly fileRepository: FileRepository,
    private readonly configService: ConfigService
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    userId?: string
  ): Promise<FileUploadResult> {
    const uploadResult = await new Promise<UploadApiResponse>(
      (resolve, reject) => {
        const uploadStream = this.cloudinary.uploader.upload_stream(
          {
            folder: this.configService.get<string>('app.name') || 'ecommerce',
            resource_type: 'auto'
          },
          (error: UploadApiErrorResponse, result: UploadApiResponse) => {
            if (error) return reject(new Error(error.message));
            if (!result)
              return reject(new Error('Tải lên Cloudinary thất bại'));
            resolve(result);
          }
        );

        streamifier.createReadStream(file.buffer).pipe(uploadStream);
      }
    );

    const savedFile = await this.fileRepository.create({
      filename: file.originalname,
      publicId: uploadResult.public_id,
      url: uploadResult.secure_url,
      mimetype: file.mimetype,
      size: file.size,
      ...(userId && { user: { connect: { id: userId } } })
    });

    return {
      id: savedFile.id,
      url: savedFile.url,
      publicId: savedFile.publicId,
      size: savedFile.size,
      mimetype: savedFile.mimetype
    };
  }

  async uploadFiles(
    files: Express.Multer.File[],
    userId?: string
  ): Promise<FileUploadResult[]> {
    const uploadResults = await Promise.all(
      files.map((file) => this.uploadFile(file, userId))
    );
    return uploadResults;
  }
}
