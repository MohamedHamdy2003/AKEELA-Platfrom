import { createTransport, type Transporter } from 'nodemailer';
import type { SmtpProviderConfig } from '../../../config/auth.environment';
import { smtpOptions } from '../smtp.options';
import type { MailProvider, OutgoingMail } from './mail-provider.interface';

export class SmtpMailProvider implements MailProvider {
  readonly name: string;
  private readonly from: string;
  private readonly transport: Transporter;

  constructor(config: SmtpProviderConfig) {
    this.name = config.name;
    this.from = config.from;
    this.transport = createTransport(
      smtpOptions({
        SMTP_HOST: config.host,
        SMTP_PORT: config.port,
        SMTP_SECURE: config.secure,
        SMTP_REQUIRE_TLS: config.requireTls,
        SMTP_USER: config.user,
        SMTP_PASSWORD: config.password,
      }),
    );
  }

  async send(message: OutgoingMail): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async verify(): Promise<void> {
    await this.transport.verify();
  }

  close(): void {
    this.transport.close();
  }
}
