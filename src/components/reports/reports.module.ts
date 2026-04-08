import { Module } from '@nestjs/common';
import { PrismaModule } from '@core/modules/prisma/prisma.module';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService]
})
export class ReportsModule {}
