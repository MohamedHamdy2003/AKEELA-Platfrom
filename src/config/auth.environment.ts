export interface AuthEnvironment {
  JWT_SECRET: string;
  JWT_ISSUER: string;
  JWT_AUDIENCE: string;
  JWT_ACCESS_TTL_SECONDS: number;
  AUTH_REFRESH_TTL_SECONDS: number;
  OTP_SECRET: string;
  OTP_TTL_SECONDS: number;
  OTP_MAX_ATTEMPTS: number;
  OTP_RESEND_SECONDS: number;
  AUTH_RATE_WINDOW_SECONDS: number;
  AUTH_RATE_IP_LIMIT: number;
  AUTH_RATE_ACCOUNT_LIMIT: number;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_REQUIRE_TLS: boolean;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  SMTP_FROM: string;
  TRUST_PROXY: boolean;
}

export function validateAuthEnvironment(
  input: Record<string, unknown>,
): AuthEnvironment {
  const text = (key: string, fallback?: string): string => {
    const value = input[key] ?? fallback;
    if (typeof value !== 'string' || !value.trim())
      throw new Error(`${key} is required.`);
    return value;
  };
  const secret = (key: string): string => {
    const value = text(key);
    if (value.length < 32 || /^(change|replace|example)/i.test(value))
      throw new Error(
        `${key} must be an independent random secret of at least 32 characters.`,
      );
    return value;
  };
  const integer = (key: string, fallback: number, maximum: number): number => {
    const value = Number(input[key] ?? fallback);
    if (!Number.isInteger(value) || value < 1 || value > maximum)
      throw new Error(`${key} is outside its allowed range.`);
    return value;
  };
  const bool = (key: string, fallback: boolean): boolean => {
    const value = input[key] ?? String(fallback);
    if (value !== 'true' && value !== 'false')
      throw new Error(`${key} must be true or false.`);
    return value === 'true';
  };
  const jwtSecret = secret('JWT_SECRET');
  const otpSecret = secret('OTP_SECRET');
  if (jwtSecret === otpSecret)
    throw new Error('JWT_SECRET and OTP_SECRET must be different.');
  const smtpUser = typeof input.SMTP_USER === 'string' ? input.SMTP_USER : '';
  const smtpPassword =
    typeof input.SMTP_PASSWORD === 'string' ? input.SMTP_PASSWORD : '';
  if (Boolean(smtpUser) !== Boolean(smtpPassword))
    throw new Error('SMTP_USER and SMTP_PASSWORD must be provided together.');
  const secure = bool('SMTP_SECURE', false);
  const requireTls = bool('SMTP_REQUIRE_TLS', input.NODE_ENV === 'production');
  if (input.NODE_ENV === 'production' && !secure && !requireTls)
    throw new Error('Production SMTP requires TLS.');
  return {
    JWT_SECRET: jwtSecret,
    OTP_SECRET: otpSecret,
    JWT_ISSUER: text('JWT_ISSUER', 'akeela-api'),
    JWT_AUDIENCE: text('JWT_AUDIENCE', 'akeela-clients'),
    JWT_ACCESS_TTL_SECONDS: integer('JWT_ACCESS_TTL_SECONDS', 900, 3600),
    AUTH_REFRESH_TTL_SECONDS: integer(
      'AUTH_REFRESH_TTL_SECONDS',
      2592000,
      7776000,
    ),
    OTP_TTL_SECONDS: integer('OTP_TTL_SECONDS', 600, 1800),
    OTP_MAX_ATTEMPTS: integer('OTP_MAX_ATTEMPTS', 5, 10),
    OTP_RESEND_SECONDS: integer('OTP_RESEND_SECONDS', 60, 3600),
    AUTH_RATE_WINDOW_SECONDS: integer('AUTH_RATE_WINDOW_SECONDS', 900, 86400),
    AUTH_RATE_IP_LIMIT: integer('AUTH_RATE_IP_LIMIT', 60, 10000),
    AUTH_RATE_ACCOUNT_LIMIT: integer('AUTH_RATE_ACCOUNT_LIMIT', 10, 10000),
    SMTP_HOST: text('SMTP_HOST', 'localhost'),
    SMTP_PORT: integer('SMTP_PORT', 11025, 65535),
    SMTP_SECURE: secure,
    SMTP_REQUIRE_TLS: requireTls,
    SMTP_USER: smtpUser,
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM: text('SMTP_FROM', 'AKEELA <noreply@example.com>'),
    TRUST_PROXY: bool('TRUST_PROXY', false),
  };
}
