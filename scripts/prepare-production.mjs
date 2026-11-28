import {
  chmodSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parsePrivateEnvironment,
  renderPrivateEnvironment,
} from './production-env.mjs';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const { parse } = require('dotenv');
const { isEmail } = require('class-validator');
try {
  const target = new URL('../.env.production.local', import.meta.url);
  const values = parsePrivateEnvironment(readFileSync(target, 'utf8'), parse);
  let local = {};
  try {
    local = parse(readFileSync(new URL('../apps/api/.env', import.meta.url)));
  } catch {
    local = {};
  }
  for (const key of [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
  ])
    if (!values[key]) values[key] = local[key] ?? '';
  const required = [
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'ADMIN_FULL_NAME',
    'ADMIN_PHONE',
    'ACME_EMAIL',
    'POSTGRES_PASSWORD',
    'DATABASE_URL',
    'JWT_SECRET',
    'OTP_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
    'APP_DOMAIN',
    'ADMIN_DOMAIN',
    'VENDOR_DOMAIN',
    'DELIVERY_DOMAIN',
    'CORS_ORIGINS',
  ];
  const missing = required.filter((key) => !values[key]?.trim());
  if (missing.length)
    throw new Error('Fill private fields: ' + missing.join(', '));
  if (
    ['localhost', '127.0.0.1', '::1'].includes(
      values.SMTP_HOST.trim().toLowerCase(),
    )
  )
    throw new Error('Production SMTP_HOST cannot point to localhost.');
  if (
    !isEmail(values.ADMIN_EMAIL) ||
    !isEmail(values.ACME_EMAIL) ||
    !/^\+[1-9]\d{7,14}$/.test(values.ADMIN_PHONE) ||
    values.ADMIN_PASSWORD.length < 8 ||
    values.ADMIN_PASSWORD.length > 128 ||
    !/(?=.*\p{L})(?=.*\p{Nd})/su.test(values.ADMIN_PASSWORD)
  )
    throw new Error('Admin/email fields do not meet the documented format.');
  if (
    values.JWT_SECRET.length < 32 ||
    values.OTP_SECRET.length < 32 ||
    values.JWT_SECRET === values.OTP_SECRET
  )
    throw new Error('Use distinct production signing keys (32+ characters).');
  for (const domain of [
    'APP_DOMAIN',
    'ADMIN_DOMAIN',
    'VENDOR_DOMAIN',
    'DELIVERY_DOMAIN',
  ])
    if (!/^[a-zA-Z0-9.-]+$/.test(values[domain]))
      throw new Error('Invalid public domain field: ' + domain);
  const corsList = values.CORS_ORIGINS.split(',').map((o) => o.trim());
  for (const domainKey of [
    'ADMIN_DOMAIN',
    'VENDOR_DOMAIN',
    'DELIVERY_DOMAIN',
  ]) {
    const expectedOrigin = `https://${values[domainKey]}`;
    if (!corsList.includes(expectedOrigin))
      throw new Error(`CORS_ORIGINS must include ${expectedOrigin}.`);
  }
  const fcmValues = [
    values.FCM_PROJECT_ID?.trim(),
    values.FCM_CLIENT_EMAIL?.trim(),
    values.FCM_PRIVATE_KEY?.trim(),
  ].filter(Boolean);
  if (fcmValues.length > 0 && fcmValues.length < 3)
    throw new Error(
      'Set all three FCM_PROJECT_ID, FCM_CLIENT_EMAIL, and FCM_PRIVATE_KEY together, or leave all blank.',
    );
  const database = new URL(values.DATABASE_URL);
  if (
    !['postgresql:', 'postgres:'].includes(database.protocol) ||
    database.hostname !== 'postgres' ||
    decodeURIComponent(database.username) !== 'akeela' ||
    database.pathname !== '/akeela' ||
    database.search ||
    database.hash ||
    decodeURIComponent(database.password) !== values.POSTGRES_PASSWORD
  )
    throw new Error('Production database credentials/hostname do not match.');
  if (Object.values(values).some((value) => /[\r\n\0]/.test(value)))
    throw new Error('Environment fields must be single-line values.');
  // Validate rendered file with Docker Compose BEFORE overwriting .env.production.local.
  const content = renderPrivateEnvironment(values);
  const tempTarget = new URL('../.env.production.local.tmp', import.meta.url);
  const composeFile = fileURLToPath(
    new URL('../compose.production.yml', import.meta.url),
  );
  writeFileSync(tempTarget, content, { mode: 0o600 });
  try {
    chmodSync(tempTarget, 0o600);
  } catch {
    // Windows filesystems ignore POSIX mode bits.
  }
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      fileURLToPath(tempTarget),
      '-f',
      composeFile,
      'config',
      '--quiet',
    ],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  if (result.status !== 0) {
    try {
      unlinkSync(tempTarget);
    } catch {
      // Ignore cleanup failure.
    }
    throw new Error(
      'Compose preflight failed; inspect required setting names, not secret dumps.',
    );
  }
  renameSync(tempTarget, target);
  console.log(
    'Private production configuration validated; SMTP populated from the local API only for missing fields. No values displayed.',
  );
} catch (error) {
  console.error(
    error instanceof Error && !error.message.includes('ENOENT')
      ? error.message
      : 'Create the ignored .env.production.local first; see docs/DEPLOYMENT.md.',
  );
  process.exitCode = 1;
}
