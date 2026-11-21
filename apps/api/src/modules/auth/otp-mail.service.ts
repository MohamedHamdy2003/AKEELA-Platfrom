import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';
import { buildOtpEmail } from './otp-mail.template';
import {
  MAIL_PROVIDER,
  type MailProvider,
} from './mail/mail-provider.interface';

@Injectable()
export class OtpMailService implements OnModuleDestroy {
  constructor(
    private readonly config: ConfigService<Environment, true>,
    @Inject(MAIL_PROVIDER) private readonly mailProvider: MailProvider,
  ) {}

  onModuleDestroy(): void {
    this.mailProvider.close();
  }

  async send(email: string, purpose: string, code: string): Promise<boolean> {
    try {
      const ttlSeconds = this.config.get('OTP_TTL_SECONDS', { infer: true });
      const content = buildOtpEmail(purpose, code, ttlSeconds);
      await this.mailProvider.send({
        to: email,
        subject: content.subject,
        text: content.text,
        html: content.html,
        attachments: content.attachments,
      });
      return true;
    } catch {
      Logger.warn(
        'OTP email delivery failed across all configured providers. The saved account/code remains available for a limited resend.',
        'Mail',
      );
      return false;
    }
  }
}
