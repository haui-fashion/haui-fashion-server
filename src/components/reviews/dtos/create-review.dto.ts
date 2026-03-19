import { FileDto } from '@common/dtos/file.dto';
import { Label } from '@core/utilities/decorators/label.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested
} from 'class-validator';

export class ReviewImageInputDto {
  @ApiPropertyOptional()
  @Label('ID tệp đã tải lên')
  @IsOptional()
  @ValidateIf((o: ReviewImageInputDto) => !o.file)
  @IsUUID()
  fileId?: string;

  @ApiPropertyOptional({ type: () => FileDto })
  @Label('Thông tin tệp')
  @IsOptional()
  @ValidateIf((o: ReviewImageInputDto) => !o.fileId)
  @IsObject()
  @ValidateNested()
  @Type(() => FileDto)
  file?: FileDto;
}

export class CreateReviewDto {
  @ApiProperty()
  @Label('ID sản phẩm')
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @Label('Số sao đánh giá')
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  star: number;

  @ApiPropertyOptional()
  @Label('Nội dung đánh giá')
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    type: () => ReviewImageInputDto,
    description: 'Hỗ trợ cả fileId và file dto (id/url/fileName).'
  })
  @Label('Ảnh đánh giá')
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ReviewImageInputDto)
  image?: ReviewImageInputDto;
}
