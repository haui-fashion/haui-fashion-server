import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { LocationService } from '@components/locations/services/location.service';

@ApiTags('Locations')
@Controller({ path: 'locations', version: '1' })
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('provinces')
  @ApiOperation({ summary: 'Lấy danh sách Tỉnh/Thành phố từ GHN' })
  async getProvinces() {
    return this.locationService.getProvinces();
  }

  @Get('districts')
  @ApiOperation({ summary: 'Lấy danh sách Quận/Huyện từ GHN' })
  @ApiQuery({ name: 'provinceId', required: true, type: Number })
  async getDistricts(@Query('provinceId') provinceId: string) {
    return this.locationService.getDistricts(Number(provinceId));
  }

  @Get('wards')
  @ApiOperation({ summary: 'Lấy danh sách Phường/Xã từ GHN' })
  @ApiQuery({ name: 'districtId', required: true, type: Number })
  async getWards(@Query('districtId') districtId: string) {
    return this.locationService.getWards(Number(districtId));
  }
}
