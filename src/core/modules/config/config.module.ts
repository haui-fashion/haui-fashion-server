import configuration from '@core/modules/config/configuration';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration]
    })
  ],
  providers: [ConfigService],
  exports: [ConfigModule, ConfigService]
})
export class AppConfigModule {}
