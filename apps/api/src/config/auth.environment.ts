export interface SmtpProviderConfig {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  password: string;
  from: string;
}

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
  SMTP_PROVIDERS: SmtpProviderConfig[];
  TRUST_PROXY: boolean;
}

function inferProviderName(host: string, fallbackLabel: string): string {
  if (host.includes('resend')) return 'resend';
  if (host.includes('brevo') || host.includes('sendinblue')) return 'brevo';
  if (host === 'smtp.gmail.com') return 'gmail';
  if (host.includes('amazonaws')) return 'ses';
  if (host.includes('postmark')) return 'postmark';
  if (host.includes('mailgun')) return 'mailgun';
  if (host.includes('hostinger') || host.includes('titan')) return 'hostinger';
  return fallbackLabel;
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
  const validateProvider = (
    prefix: string,
    defaults: {
      host?: string;
      port: number;
      from: string;
      label: string;
    },
  ): SmtpProviderConfig => {
    const isFallback = prefix !== 'SMTP';
    const opt = (key: string): unknown => {
      const raw = input[key];
      return isFallback && raw === '' ? undefined : raw;
    };
    const rawHost = opt(`${prefix}_HOST`);
    const host =
      typeof rawHost === 'string' && rawHost.trim()
        ? rawHost.trim().toLowerCase()
        : (defaults.host ?? '');
    if (!host) throw new Error(`${prefix}_HOST is required.`);
    const portRaw = opt(`${prefix}_PORT`);
    const port =
      portRaw === undefined
        ? defaults.port
        : integer(`${prefix}_PORT`, defaults.port, 65535);
    const user =
      typeof input[`${prefix}_USER`] === 'string'
        ? (input[`${prefix}_USER`] as string).trim()
        : '';
    let password =
      typeof input[`${prefix}_PASSWORD`] === 'string'
        ? (input[`${prefix}_PASSWORD`] as string)
        : '';
    const rawFrom = opt(`${prefix}_FROM`);
    const from =
      typeof rawFrom === 'string' && rawFrom.trim()
        ? rawFrom.trim()
        : defaults.from;
    if (!from || /[\r\n]/.test(from))
      throw new Error(`${prefix}_FROM must be a valid single-line sender.`);
    if (Boolean(user) !== Boolean(password))
      throw new Error(
        `${prefix}_USER and ${prefix}_PASSWORD must be provided together.`,
      );
    const secureRaw = opt(`${prefix}_SECURE`);
    const secure =
      secureRaw === undefined ? false : bool(`${prefix}_SECURE`, false);
    const requireTlsRaw = opt(`${prefix}_REQUIRE_TLS`);
    const requireTls =
      requireTlsRaw === undefined
        ? input.NODE_ENV === 'production'
        : bool(`${prefix}_REQUIRE_TLS`, input.NODE_ENV === 'production');
    if (input.NODE_ENV === 'production' && !secure && !requireTls)
      throw new Error(`Production ${prefix} requires TLS.`);
    if (host === 'smtp.gmail.com') {
      password = password.replace(/\s/g, '');
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) ||
        !/^[A-Za-z0-9]{16}$/.test(password)
      )
        throw new Error(
          `Gmail requires ${prefix}_USER and a 16-character Google App Password in ${prefix}_PASSWORD.`,
        );
      if (!(
        (port === 465 && secure) ||
        (port === 587 && !secure && requireTls)
      ))
        throw new Error(
          'Gmail requires port 465 with SMTP_SECURE=true, or port 587 with required STARTTLS.',
        );
      const fromAddress = (from.match(/<([^<>]+)>/)?.[1] ?? from)
        .trim()
        .toLowerCase();
      if (fromAddress !== user.toLowerCase())
        throw new Error(
          `For Gmail, ${prefix}_FROM must use the authenticated ${prefix}_USER address.`,
        );
    }
    const rawName = input[`${prefix}_NAME`];
    const name =
      typeof rawName === 'string' && rawName.trim()
        ? rawName.trim().toLowerCase()
        : inferProviderName(host, defaults.label);
    return {
      name,
      host,
      port,
      secure,
      requireTls,
      user,
      password,
      from,
    };
  };

  const primary = validateProvider('SMTP', {
    host: 'localhost',
    port: 11025,
    from: 'AKEELA <noreply@example.com>',
    label: 'primary',
  });

  const providers: SmtpProviderConfig[] = [primary];
  const fallbackPrefixes = [
    ['SMTP_FALLBACK', 'fallback-1'],
    ['SMTP_FALLBACK_2', 'fallback-2'],
    ['SMTP_FALLBACK_3', 'fallback-3'],
    ['SMTP_FALLBACK_4', 'fallback-4'],
    ['SMTP_FALLBACK_5', 'fallback-5'],
  ] as const;

  for (const [prefix, label] of fallbackPrefixes) {
    const rawHost = input[`${prefix}_HOST`];
    if (typeof rawHost === 'string' && rawHost.trim()) {
      providers.push(
        validateProvider(prefix, {
          port: 587,
          from: primary.from,
          label,
        }),
      );
    }
  }

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
    SMTP_HOST: primary.host,
    SMTP_PORT: primary.port,
    SMTP_SECURE: primary.secure,
    SMTP_REQUIRE_TLS: primary.requireTls,
    SMTP_USER: primary.user,
    SMTP_PASSWORD: primary.password,
    SMTP_FROM: primary.from,
    SMTP_PROVIDERS: providers,
    TRUST_PROXY: bool('TRUST_PROXY', false),
  };
}
