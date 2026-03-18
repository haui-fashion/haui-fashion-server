import { AddressModule } from '@components/addresses/addresses.module';
import { AuthModule } from '@components/auth/auth.module';
import { CategoryModule } from '@components/categories/categories.module';
import { FilesModule } from '@components/files/files.module';
import { ProductsModule } from '@components/products/products.module';
import { UserModule } from '@components/users/users.module';
import { VariantsModule } from '@components/variants/variants.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    UserModule,
    AuthModule,
    FilesModule,
    CategoryModule,
    AddressModule,
    ProductsModule,
    VariantsModule
  ],
  controllers: [],
  providers: [],
  exports: []
})
export class ComponentModule {}
