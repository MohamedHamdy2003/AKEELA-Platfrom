import { AuthEnvironment, validateAuthEnvironment } from './auth.environment';

export interface Environment extends AuthEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  CORS_ORIGINS: string[];
  DEFAULT_DELIVERY_COMPANY_ID: string | null;
}

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const mode = input.NODE_ENV ?? 'development';
  if (mode !== 'development' && mode !== 'test' && mode !== 'production') {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  const port = Number(input.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const databaseUrl = input.DATABASE_URL;
  if (typeof databaseUrl !== 'string') {
    throw new Error('DATABASE_URL is required.');
  }
  try {
    const parsed = new URL(databaseUrl);
    if (
      !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.pathname.length <= 1 ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error();
    }
  } catch {
    // Do not echo a URL containing credentials into error output.
    throw new Error(
      'DATABASE_URL must be a PostgreSQL URL with a database name and no query or fragment.',
    );
  }

  const ssl = input.DATABASE_SSL ?? 'false';
  if (ssl !== 'true' && ssl !== 'false') {
    throw new Error('DATABASE_SSL must be true or false.');
  }

  const rawOrigins = input.CORS_ORIGINS ?? '';
  if (typeof rawOrigins !== 'string') {
    throw new Error('CORS_ORIGINS must be a comma-separated string.');
  }
  const origins = rawOrigins
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const origin of origins) {
    try {
      const parsed = new URL(origin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.origin !== origin
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        'CORS_ORIGINS must contain exact HTTP(S) origins without paths.',
      );
    }
  }

  const companyId = input.DEFAULT_DELIVERY_COMPANY_ID ?? '';
  if (
    typeof companyId !== 'string' ||
    (companyId !== '' &&
      (!/^[1-9]\d{0,18}$/.test(companyId) ||
        BigInt(companyId) > 9223372036854775807n))
  ) {
    throw new Error(
      'DEFAULT_DELIVERY_COMPANY_ID must be a positive BIGINT ID or empty.',
    );
  }
  return {
    ...validateAuthEnvironment(input),
    NODE_ENV: mode,
    PORT: port,
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: ssl === 'true',
    CORS_ORIGINS: origins,
    DEFAULT_DELIVERY_COMPANY_ID: companyId || null,
  };
}
