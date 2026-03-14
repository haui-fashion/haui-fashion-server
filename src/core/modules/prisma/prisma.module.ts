import { Global, Module } from '@nestjs/common';
import { EntityCodeService } from './entity-code.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, EntityCodeService],
  exports: [PrismaService, EntityCodeService]
})
export class PrismaModule {}
