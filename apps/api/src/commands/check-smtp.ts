import { config as loadEnv } from 'dotenv';
import { validateEnvironment } from '../config/environment';
import { SmtpMailProvider } from '../modules/auth/mail/smtp-mail.provider';

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

  const total = settings.SMTP_PROVIDERS.length;
  for (let i = 0; i < total; i += 1) {
    const item = settings.SMTP_PROVIDERS[i]!;
    const provider = new SmtpMailProvider(item);
    try {
      await provider.verify();
      console.log(
        `[${i + 1}/${total}] ${item.name} (${item.host}:${item.port}): SMTP connection, TLS, and authentication succeeded. No email was sent.`,
      );
    } catch {
      console.error(
        `[${i + 1}/${total}] ${item.name} (${item.host}:${item.port}): SMTP check failed. Check host/port, TLS, and credentials. See docs/GMAIL.md.`,
      );
      process.exitCode = 1;
    } finally {
      provider.close();
    }
  }
}

void check();
