import { AuthEnvironment } from '../../config/auth.environment';

export function smtpOptions(
  config: Pick<
    AuthEnvironment,
    | 'SMTP_HOST'
    | 'SMTP_PORT'
    | 'SMTP_SECURE'
    | 'SMTP_REQUIRE_TLS'
    | 'SMTP_USER'
    | 'SMTP_PASSWORD'
  >,
) {
  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    requireTLS: config.SMTP_REQUIRE_TLS,
    ...(config.SMTP_USER
      ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 10000,
    socketTimeout: 10000,
    greetingTimeout: 10000,
    logger: false,
    debug: false,
  };
}
