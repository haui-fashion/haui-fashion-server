import { Public } from '@core/utilities/decorators/public.decorator';
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MailTestTriggerDto } from '../dtos/mail-test-trigger.dto';
import { MailService } from '../services/mail.service';

@ApiTags('Mail')
@Controller({ path: 'mail', version: '1' })
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Public()
  @Post('test-trigger')
  async testTrigger(@Body() dto: MailTestTriggerDto) {
    await this.mailService.sendTemplateEmail({
      to: dto.to,
      subject: dto.subject || 'Welcome to HAUI Fashion',
      template: dto.template || 'welcome',
      context: {
        name: dto.name || 'HAUI Fashion User',
        url: dto.url || 'http://localhost:3000'
      }
    });

    return {
      message: 'Mail job has been queued successfully',
      to: dto.to
    };
  }
}
