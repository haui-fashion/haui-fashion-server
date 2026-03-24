import { Label } from '@core/utilities/decorators/label.decorator';
import { Gender } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString
} from 'class-validator';

export class UpdateProfileDto {
  @Label('Họ và tên')
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  fullname?: string;

  @Label('Số điện thoại')
  @IsOptional()
  @IsString()
  phone?: string;

  @Label('Ngày sinh')
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @Label('Giới tính')
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;
}
