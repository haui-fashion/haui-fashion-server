import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface ISendMailOptions {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@InjectQueue('mail') private readonly mailQueue: Queue) {}

  async sendTemplateEmail(options: ISendMailOptions): Promise<void> {
    try {
      await this.mailQueue.add('sendTemplateEmail', options, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
      this.logger.log(`Queued email ${options.template} to ${options.to}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to queue email to ${options.to}: ${error.message}`,
        error.stack
      );
    }
  }
}
