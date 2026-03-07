import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ComponentModule } from './components/component.module';
import { CoreModule } from './core/modules/core.module';

@Module({
  imports: [ComponentModule, CoreModule],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}
