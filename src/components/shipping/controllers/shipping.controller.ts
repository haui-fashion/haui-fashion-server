import { GetShippingFeeDto } from '@components/shipping/dtos/get-shipping-fee.dto';
import { ShippingService } from '@components/shipping/services/shipping.serivce';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Locations')
@Controller({ path: 'locations', version: '1' })
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Lấy danh sách Tỉnh/Thành phố từ GHN' })
  async getProvinces() {
    return this.shippingService.getProvinces();
  }

  @Get('districts')
  @ApiOperation({ summary: 'Lấy danh sách Quận/Huyện từ GHN' })
  @ApiQuery({ name: 'provinceId', required: true, type: Number })
  async getDistricts(@Query('provinceId') provinceId: string) {
    return this.shippingService.getDistricts(Number(provinceId));
  }

  @Get('wards')
  @ApiOperation({ summary: 'Lấy danh sách Phường/Xã từ GHN' })
  @ApiQuery({ name: 'districtId', required: true, type: Number })
  async getWards(@Query('districtId') districtId: string) {
    return this.shippingService.getWards(Number(districtId));
  }

  @Get('shipping-fee')
  @ApiOperation({ summary: 'Tính phí vận chuyển từ GHN' })
  async getShippingFee(@Param() GetShippingFeeDto: GetShippingFeeDto) {
    return this.shippingService.getShippingFee(GetShippingFeeDto);
  }
}
