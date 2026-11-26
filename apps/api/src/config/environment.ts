import { isAbsolute, resolve } from 'node:path';
import { AuthEnvironment, validateAuthEnvironment } from './auth.environment';

export interface Environment extends AuthEnvironment {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  SWAGGER_ENABLED: boolean;
  PUBLIC_BASE_URL: string;
  IMAGE_STORAGE_PATH: string;
  DATABASE_URL: string;
  DATABASE_SSL: boolean;
  CORS_ORIGINS: string[];
  DEFAULT_DELIVERY_COMPANY_ID: string | null;
  FCM_PROJECT_ID: string | null;
  FCM_CLIENT_EMAIL: string | null;
  FCM_PRIVATE_KEY: string | null;
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
  const swagger =
    input.SWAGGER_ENABLED ?? (mode === 'production' ? 'false' : 'true');
  if (swagger !== 'true' && swagger !== 'false') {
    throw new Error('SWAGGER_ENABLED must be true or false.');
  }
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

  const publicBase =
    input.PUBLIC_BASE_URL ??
    (mode === 'production' ? '' : `http://localhost:${port}`);
  if (typeof publicBase !== 'string')
    throw new Error('PUBLIC_BASE_URL must be an origin URL.');
  try {
    const parsed = new URL(publicBase);
    if (
      parsed.origin !== publicBase ||
      parsed.username ||
      parsed.password ||
      !['http:', 'https:'].includes(parsed.protocol) ||
      (mode === 'production' && parsed.protocol !== 'https:')
    )
      throw new Error();
  } catch {
    throw new Error(
      'PUBLIC_BASE_URL must be an HTTP origin (HTTPS is required in production).',
    );
  }
  const imagePath = input.IMAGE_STORAGE_PATH ?? resolve('storage/images');
  if (typeof imagePath !== 'string' || !isAbsolute(imagePath))
    throw new Error('IMAGE_STORAGE_PATH must be an absolute directory.');
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
  const fcmProjectId =
    typeof input.FCM_PROJECT_ID === 'string' ? input.FCM_PROJECT_ID.trim() : '';
  const fcmClientEmail =
    typeof input.FCM_CLIENT_EMAIL === 'string'
      ? input.FCM_CLIENT_EMAIL.trim()
      : '';
  const rawFcmPrivateKey =
    typeof input.FCM_PRIVATE_KEY === 'string'
      ? input.FCM_PRIVATE_KEY.trim()
      : '';
  const fcmPrivateKey = rawFcmPrivateKey.replace(/\\n/g, '\n');
  const fcmSetCount = [fcmProjectId, fcmClientEmail, fcmPrivateKey].filter(
    Boolean,
  ).length;
  if (fcmSetCount > 0 && fcmSetCount < 3) {
    throw new Error(
      'FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY must all be set together or all left empty.',
    );
  }
  if (
    fcmPrivateKey &&
    !fcmPrivateKey.includes('-----BEGIN PRIVATE KEY-----') &&
    !fcmPrivateKey.includes('-----BEGIN RSA PRIVATE KEY-----')
  ) {
    throw new Error('FCM_PRIVATE_KEY must be a PEM-formatted private key.');
  }
  return {
    ...validateAuthEnvironment(input),
    NODE_ENV: mode,
    PUBLIC_BASE_URL: publicBase,
    IMAGE_STORAGE_PATH: imagePath,
    PORT: port,
    SWAGGER_ENABLED: swagger === 'true',
    DATABASE_URL: databaseUrl,
    DATABASE_SSL: ssl === 'true',
    CORS_ORIGINS: origins,
    DEFAULT_DELIVERY_COMPANY_ID: companyId || null,
    FCM_PROJECT_ID: fcmProjectId || null,
    FCM_CLIENT_EMAIL: fcmClientEmail || null,
    FCM_PRIVATE_KEY: fcmPrivateKey || null,
  };
}
