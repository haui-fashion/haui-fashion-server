import { Label } from '@core/utilities/decorators/label.decorator';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class CreateAddressDto {
  @Label('Họ và tên người nhận')
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @Label('Số điện thoại')
  @IsNotEmpty()
  @IsString()
  phone: string;

  @Label('Mã tỉnh/thành')
  @IsOptional()
  @IsInt()
  @Min(0)
  provinceId?: number;

  @Label('Tên tỉnh/thành')
  @IsNotEmpty()
  @IsString()
  provinceName: string;

  @Label('Mã quận/huyện')
  @IsOptional()
  @IsInt()
  @Min(0)
  districtId?: number;

  @Label('Tên quận/huyện')
  @IsNotEmpty()
  @IsString()
  districtName: string;

  @Label('Mã phường/xã')
  @IsOptional()
  @IsString()
  wardCode?: string;

  @Label('Tên phường/xã')
  @IsNotEmpty()
  @IsString()
  wardName: string;

  @Label('Địa chỉ chi tiết')
  @IsNotEmpty()
  @IsString()
  street: string;

  @Label('Đặt làm mặc định')
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
