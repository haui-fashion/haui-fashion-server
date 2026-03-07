import { AddressController } from '@components/addresses/controllers/address.controller';
import { AddressDatasource } from '@components/addresses/datasources/address.datasource';
import { AddressRepository } from '@components/addresses/repositories/address.repository';
import { AddressService } from '@components/addresses/services/address.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [AddressController],
  providers: [AddressDatasource, AddressRepository, AddressService],
  exports: [AddressService]
})
export class AddressModule {}
