import { AppConfigModule } from '@core/modules/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { EjsAdapter } from '@nestjs-modules/mailer/dist/adapters/ejs.adapter';
import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailProcessor } from './processors/mail.processor';
import { MailService } from './services/mail.service';

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('mail.host'),
          port: configService.get<number>('mail.port'),
          secure: configService.get<number>('mail.port') === 465,
          auth: {
            user: configService.get<string>('mail.user'),
            pass: configService.get<string>('mail.password')
          }
        },
        defaults: {
          from: configService.get<string>('mail.from')
        },
        template: {
          dir: join(__dirname, 'templates'),
          adapter: new EjsAdapter(),
          options: {
            strict: false
          }
        }
      }),
      inject: [ConfigService]
    }),
    BullModule.registerQueue({
      name: 'mail'
    })
  ],
  providers: [MailService, MailProcessor],
  exports: [MailService]
})
export class AppMailModule {}
