import { CurrentUser, CurrentUserDto } from '@core/utilities/decorators';
import {
  Controller,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FilesService } from '../services/files.service';

@ApiTags('Files')
@ApiBearerAuth()
@Controller({ path: 'files', version: '1' })
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })]
      })
    )
    file: Express.Multer.File,
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.filesService.uploadFile(file, user.userId);
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files'))
  @ApiConsumes('multipart/form-data')
  async uploadFiles(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })]
      })
    )
    files: Express.Multer.File[],
    @CurrentUser() user: CurrentUserDto
  ) {
    return this.filesService.uploadFiles(files, user.userId);
  }
}
