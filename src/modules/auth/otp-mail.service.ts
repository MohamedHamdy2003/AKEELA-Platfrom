import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { Environment } from '../../config/environment';

@Injectable()
export class OtpMailService {
  private readonly transport;
  constructor(private readonly config: ConfigService<Environment, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    this.transport = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      requireTLS: config.get('SMTP_REQUIRE_TLS', { infer: true }),
      ...(user
        ? { auth: { user, pass: config.get('SMTP_PASSWORD', { infer: true }) } }
        : {}),
      connectionTimeout: 10000,
      socketTimeout: 10000,
      greetingTimeout: 10000,
      logger: false,
      debug: false,
    });
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
