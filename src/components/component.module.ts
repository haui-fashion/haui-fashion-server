import { AddressModule } from '@components/addresses/addresses.module';
import { AuthModule } from '@components/auth/auth.module';
import { CategoryModule } from '@components/categories/categories.module';
import { FilesModule } from '@components/files/files.module';
import { UserModule } from '@components/users/users.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [UserModule, AuthModule, FilesModule, CategoryModule, AddressModule],
  controllers: [],
  providers: [],
  exports: []
})
export class ComponentModule {}
