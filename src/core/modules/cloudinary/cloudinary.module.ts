import { Global, Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';

@Global()
@Module({
  providers: [CloudinaryProvider],
  exports: [CloudinaryProvider]
})
export class CloudinaryModule {}
