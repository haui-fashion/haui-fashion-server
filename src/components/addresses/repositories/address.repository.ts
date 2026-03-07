import { AddressDatasource } from '@components/addresses/datasources/address.datasource';
import { AddressEntity } from '@components/addresses/entities/address.entity';
import { BaseRepository } from '@core/utilities/repositories';
import { Injectable } from '@nestjs/common';
import { Address, Prisma } from '@prisma/client';

@Injectable()
export class AddressRepository extends BaseRepository<AddressEntity, Address> {
  constructor(private readonly datasource: AddressDatasource) {
    super(AddressEntity);
  }

  async findAllByUserId(userId: string): Promise<Address[]> {
    return this.datasource.findAllByCondition(
      { userId } as Prisma.AddressWhereInput,
      { orderBy: { createdAt: 'desc' } }
    );
  }

  async findById(id: string): Promise<Address | null> {
    return this.datasource.findById(id);
  }

  async findDefaultByUserId(userId: string): Promise<Address | null> {
    return this.datasource.findOneByCondition({
      userId,
      isDefault: true
    } as Prisma.AddressWhereInput);
  }

  async countByUserId(userId: string): Promise<number> {
    return this.datasource.count({ userId } as Prisma.AddressWhereInput);
  }

  async unsetDefaultByUserId(userId: string): Promise<void> {
    await this.datasource.updateManyByCondition(
      { userId, isDefault: true } as Prisma.AddressWhereInput,
      { isDefault: false } as Prisma.AddressUpdateInput
    );
  }

  async createAddress(data: Prisma.AddressCreateInput): Promise<Address> {
    return this.datasource.create(data);
  }

  async updateAddress(
    id: string,
    data: Prisma.AddressUpdateInput
  ): Promise<Address> {
    return this.datasource.updateById(id, data);
  }

  async deleteAddress(id: string): Promise<Address> {
    return this.datasource.deleteById(id);
  }
}
