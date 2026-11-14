import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { Environment } from '../../config/environment';
import { smtpOptions } from './smtp.options';

@Injectable()
export class OtpMailService {
  private readonly transport;
  constructor(private readonly config: ConfigService<Environment, true>) {
    this.transport = createTransport(
      smtpOptions({
        SMTP_HOST: config.get('SMTP_HOST', { infer: true }),
        SMTP_PORT: config.get('SMTP_PORT', { infer: true }),
        SMTP_SECURE: config.get('SMTP_SECURE', { infer: true }),
        SMTP_REQUIRE_TLS: config.get('SMTP_REQUIRE_TLS', { infer: true }),
        SMTP_USER: config.get('SMTP_USER', { infer: true }),
        SMTP_PASSWORD: config.get('SMTP_PASSWORD', { infer: true }),
      }),
    );
  }
  async send(email: string, purpose: string, code: string): Promise<boolean> {
    try {
      await this.transport.sendMail({
        from: this.config.get('SMTP_FROM', { infer: true }),
        to: email,
        subject:
          purpose === 'Email_Verification'
            ? 'AKEELA: Verify your email'
            : 'AKEELA: Reset your password',
        text: `Your AKEELA code is ${code}. It expires in ${this.config.get('OTP_TTL_SECONDS', { infer: true })} seconds. If you did not request it, ignore this email.`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      return true;
    } catch {
      Logger.warn(
        'OTP email delivery failed. The saved account/code remains available for a limited resend.',
        'Mail',
      );
      return false;
    }
  }
}
