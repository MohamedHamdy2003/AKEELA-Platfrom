import { config as loadEnv } from 'dotenv';
import { createTransport } from 'nodemailer';
import { validateEnvironment } from '../config/environment';
import { smtpOptions } from '../modules/auth/smtp.options';

async function check(): Promise<void> {
  loadEnv({ quiet: true });
  let settings;
  try {
    settings = validateEnvironment(process.env);
  } catch (error) {
    // Configuration errors name keys only, never values.
    console.error(
      error instanceof Error ? error.message : 'Invalid SMTP configuration.',
    );
    process.exitCode = 1;
    return;
  }
  const transport = createTransport(smtpOptions(settings));
  try {
    await transport.verify();
    console.log(
      settings.SMTP_HOST === 'smtp.gmail.com'
        ? 'Gmail SMTP connection, TLS, and authentication succeeded. No email was sent.'
        : 'SMTP connection check succeeded. No email was sent.',
    );
  } catch {
    console.error(
      'SMTP check failed. Check host/port, TLS, and credentials. For Gmail use a Google App Password, not the account password. See docs/GMAIL.md.',
    );
    process.exitCode = 1;
  } finally {
    transport.close();
  }
}

void check();
