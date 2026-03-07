import { Module } from '@nestjs/common';
import { FilesController } from './controllers/files.controller';
import { FileDatasource } from './datasources/file.datasource';
import { FileRepository } from './repositories/file.repository';
import { FilesService } from './services/files.service';

@Module({
  controllers: [FilesController],
  providers: [FileDatasource, FileRepository, FilesService],
  exports: [FilesService]
})
export class FilesModule {}
