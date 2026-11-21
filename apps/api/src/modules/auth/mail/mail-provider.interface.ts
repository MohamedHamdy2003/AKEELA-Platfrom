import type { Attachment } from 'nodemailer/lib/mailer';

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Attachment[];
}

export interface MailProvider {
  readonly name: string;
  send(message: OutgoingMail): Promise<void>;
  verify(): Promise<void>;
  close(): void;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
