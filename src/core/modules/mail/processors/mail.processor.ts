import { ISendMailOptions } from '@core/modules/mail/services/mail.service';
import { MailerService } from '@nestjs-modules/mailer';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailerService: MailerService) {
    super();
  }

  async process(job: Job<ISendMailOptions>): Promise<any> {
    this.logger.log(
      `Processing email job ${job.id} for template: ${job.data.template} to ${job.data.to}`
    );

    try {
      await this.mailerService.sendMail({
        to: job.data.to,
        subject: job.data.subject,
        template: job.data.template,
        context: job.data.context
      });
      this.logger.log(`Successfully sent email job ${job.id}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send email job ${job.id}: ${error.message}`,
        error.stack
      );
      throw error; // Re-throw to trigger BullMQ retry mechanisms
    }
  }
}
