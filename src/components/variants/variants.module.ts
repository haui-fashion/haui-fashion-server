import { VariantController } from '@components/variants/controllers/variant.controller';
import { VariantDatasource } from '@components/variants/datasources/variant.datasource';
import { VariantRepository } from '@components/variants/repositories/variant.repository';
import { VariantService } from '@components/variants/services/variant.service';
import { Module } from '@nestjs/common';

@Module({
  controllers: [VariantController],
  providers: [VariantDatasource, VariantRepository, VariantService],
  exports: [VariantService]
})
export class VariantsModule {}
