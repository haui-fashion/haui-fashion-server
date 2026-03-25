import { ISendMailOptions } from '@core/modules/mail/services/mail.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import ejs from 'ejs';
import { constants } from 'fs';
import { access } from 'fs/promises';
import { join } from 'path';
import { Resend } from 'resend';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    super();

    const resendApiKey = this.configService.get<string>('mail.resendApiKey');

    if (!resendApiKey) {
      this.logger.warn(
        'MAIL provider is configured for Resend but RESEND_API_KEY is missing.'
      );
    }

    this.resend = new Resend(resendApiKey);
    this.from =
      this.configService.get<string>('mail.from') ||
      'No Reply <noreply@hauifashion.com>';
  }

  async process(job: Job<ISendMailOptions>): Promise<any> {
    this.logger.log(
      `Processing email job ${job.id} for template: ${job.data.template} to ${job.data.to}`
    );

    try {
      const templateFile = await this.resolveTemplateFile(job.data.template);
      const html = await ejs.renderFile(
        templateFile,
        {
          ...job.data.context,
          subject: job.data.subject
        },
        {
          async: true,
          filename: templateFile
        }
      );

      const { data, error } = await this.resend.emails.send({
        from: this.from,
        to: [job.data.to],
        subject: job.data.subject,
        html
      });

      if (error) {
        throw new Error(error.message || 'Failed to send email via Resend');
      }

      this.logger.log(
        `Successfully sent email job ${job.id}${data?.id ? ` with id ${data.id}` : ''}`
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to send email job ${job.id}: ${error.message}`,
        error.stack
      );
      throw error; // Re-throw to trigger BullMQ retry mechanisms
    }
  }

  private async resolveTemplateFile(template: string): Promise<string> {
    const templateFile = `${template.replace(/\.ejs$/i, '')}.ejs`;
    const candidates = [
      join(process.cwd(), 'templates', 'mail', templateFile),
      join(process.cwd(), 'dist', 'templates', 'mail', templateFile),
      join(__dirname, '..', 'templates', templateFile)
    ];

    for (const candidate of candidates) {
      try {
        await access(candidate, constants.F_OK);
        return candidate;
      } catch {
        console.warn(`Template file not found at: ${candidate}`);
      }
    }

    throw new Error(`Mail template not found: ${templateFile}`);
  }
}
