import { AppConfigModule } from '@core/modules/config';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { MailController } from './controllers/mail.controller';
import { MailProcessor } from './processors/mail.processor';
import { MailService } from './services/mail.service';

@Global()
@Module({
  imports: [
    AppConfigModule,
    BullModule.registerQueue({
      name: 'mail'
    })
  ],
  controllers: [MailController],
  providers: [MailService, MailProcessor],
  exports: [MailService]
})
export class AppMailModule {}
