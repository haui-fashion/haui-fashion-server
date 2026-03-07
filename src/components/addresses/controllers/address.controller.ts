import { CreateAddressDto } from '@components/addresses/dtos/create-address.dto';
import { UpdateAddressDto } from '@components/addresses/dtos/update-address.dto';
import { AddressService } from '@components/addresses/services/address.service';
import { CurrentUser } from '@core/utilities/decorators/current-user.decorator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

interface CurrentUserDto {
  userId: string;
}

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller({ path: 'addresses', version: '1' })
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new address for the current user' })
  async create(
    @Body() dto: CreateAddressDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.addressService.create(dto, user.userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all addresses of the current user' })
  async findAll(@CurrentUser() user: CurrentUserDto) {
    return this.addressService.findAllByUserId(user.userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get the default address of the current user' })
  async findDefault(@CurrentUser() user: CurrentUserDto) {
    return this.addressService.findDefault(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an address by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.addressService.findById(id, user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an address' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAddressDto,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.addressService.update(id, dto, user.userId);
  }

  @Patch(':id/set-default')
  @ApiOperation({ summary: 'Set an address as default' })
  async setDefault(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.addressService.setDefault(id, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an address' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserDto) {
    return this.addressService.remove(id, user.userId);
  }
}
