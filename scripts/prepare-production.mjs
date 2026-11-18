import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(
  new URL('../apps/api/package.json', import.meta.url),
);
const { parse } = require('dotenv');
const { isEmail } = require('class-validator');
try {
  const target = new URL('../.env.production.local', import.meta.url);
  const values = parse(readFileSync(target));
  const local = parse(
    readFileSync(new URL('../apps/api/.env', import.meta.url)),
  );
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
  ];
  const missing = required.filter((key) => !values[key]?.trim());
  if (missing.length)
    throw new Error('Fill private fields: ' + missing.join(', '));
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
  const database = new URL(values.DATABASE_URL);
  if (
    database.hostname !== 'postgres' ||
    decodeURIComponent(database.password) !== values.POSTGRES_PASSWORD
  )
    throw new Error('Production database credentials/hostname do not match.');
  if (Object.values(values).some((value) => /[\r\n\0]/.test(value)))
    throw new Error('Environment fields must be single-line values.');
  // Compose single quotes prevent $ expansion. Escape apostrophes; retain literal backslashes.
  const content =
    '# PRIVATE production configuration. Never commit or print.\n' +
    Object.entries(values)
      .map(([key, value]) => `${key}='${value.replaceAll("'", "\\'")}'`)
      .join('\n') +
    '\n';
  writeFileSync(target, content, { mode: 0o600 });
  const result = spawnSync(
    'docker',
    [
      'compose',
      '--env-file',
      fileURLToPath(target),
      '-f',
      'compose.production.yml',
      'config',
      '--quiet',
    ],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(
      'Compose preflight failed; inspect required setting names, not secret dumps.',
    );
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
