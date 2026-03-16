import { CreateAddressDto } from '@components/addresses/dtos/create-address.dto';
import { UpdateAddressDto } from '@components/addresses/dtos/update-address.dto';
import { AddressRepository } from '@components/addresses/repositories/address.repository';
import {
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Address } from '@prisma/client';

@Injectable()
export class AddressService {
  constructor(private readonly addressRepository: AddressRepository) {}

  async findAllByUserId(userId: string): Promise<Address[]> {
    return this.addressRepository.findAllByUserId(userId);
  }

  async findById(id: string, userId: string): Promise<Address> {
    const address = await this.addressRepository.findById(id);
    if (!address) {
      throw new NotFoundException(`Không tìm thấy địa chỉ với id ${id}`);
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Bạn không sở hữu địa chỉ này');
    }
    return address;
  }

  async findDefault(userId: string): Promise<Address | null> {
    return this.addressRepository.findDefaultByUserId(userId);
  }

  async create(dto: CreateAddressDto, userId: string): Promise<Address> {
    const count = await this.addressRepository.countByUserId(userId);
    const isDefault = count === 0 ? true : (dto.isDefault ?? false);

    if (isDefault && count > 0) {
      await this.addressRepository.unsetDefaultByUserId(userId);
    }

    return this.addressRepository.createAddress({
      fullname: dto.fullname,
      phone: dto.phone,
      provinceId: dto.provinceId,
      provinceName: dto.provinceName,
      districtId: dto.districtId,
      districtName: dto.districtName,
      wardCode: dto.wardCode,
      wardName: dto.wardName,
      street: dto.street,
      isDefault,
      user: { connect: { id: userId } }
    });
  }

  async update(
    id: string,
    dto: UpdateAddressDto,
    userId: string
  ): Promise<Address> {
    await this.findById(id, userId);

    if (dto.isDefault === true) {
      await this.addressRepository.unsetDefaultByUserId(userId);
    }

    return this.addressRepository.updateAddress(id, dto);
  }

  async setDefault(id: string, userId: string): Promise<Address> {
    await this.findById(id, userId);
    await this.addressRepository.unsetDefaultByUserId(userId);
    return this.addressRepository.updateAddress(id, { isDefault: true });
  }

  async remove(id: string, userId: string): Promise<Address> {
    const address = await this.findById(id, userId);

    const deleted = await this.addressRepository.deleteAddress(id);

    if (address.isDefault) {
      const remaining = await this.addressRepository.findAllByUserId(userId);
      if (remaining.length > 0) {
        await this.addressRepository.updateAddress(remaining[0].id, {
          isDefault: true
        });
      }
    }

    return deleted;
  }
}
