import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEnvironment } from '../src/config/environment';
import { databaseOptions } from '../src/database/database.options';

const input = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/akeela_test',
  JWT_SECRET: 'test-only-jwt-secret-012345678901234567890',
  OTP_SECRET: 'test-only-otp-secret-012345678901234567890',
};

test('environment defaults and explicit settings are parsed', () => {
  const defaults = validateEnvironment(input);
  assert.equal(defaults.PORT, 3000);
  assert.equal(defaults.DATABASE_SSL, false);
  assert.deepEqual(defaults.CORS_ORIGINS, []);
  const explicit = validateEnvironment({
    ...input,
    NODE_ENV: 'production',
    PORT: '4000',
    DATABASE_SSL: 'true',
    CORS_ORIGINS: 'https://example.com, http://localhost:5173',
  });
  assert.equal(explicit.PORT, 4000);
  assert.equal(explicit.DATABASE_SSL, true);
  assert.deepEqual(explicit.CORS_ORIGINS, [
    'https://example.com',
    'http://localhost:5173',
  ]);
});

for (const [name, values] of Object.entries({
  'missing database': {},
  'wrong protocol': { DATABASE_URL: 'mysql://localhost/akeela' },
  'missing database name': { DATABASE_URL: 'postgresql://localhost/' },
  'URL overrides': { DATABASE_URL: `${input.DATABASE_URL}?sslmode=no-verify` },
  'invalid environment': { ...input, NODE_ENV: 'staging' },
  'invalid port': { ...input, PORT: '3000abc' },
  'out-of-range port': { ...input, PORT: '65536' },
  'invalid SSL flag': { ...input, DATABASE_SSL: 'yes' },
  'wildcard CORS': { ...input, CORS_ORIGINS: '*' },
  'CORS with path': { ...input, CORS_ORIGINS: 'https://example.com/app' },
})) {
  test(`environment rejects ${name}`, () => {
    assert.throws(() => validateEnvironment(values));
  });
}

test('invalid database input is never echoed in validation errors', () => {
  assert.throws(
    () => validateEnvironment({ DATABASE_URL: 'secret-password' }),
    (error: unknown) =>
      error instanceof Error && !error.message.includes('secret-password'),
  );
});

test('database options prevent automatic schema changes and unsafe TLS', () => {
  const options = databaseOptions(
    validateEnvironment({ ...input, DATABASE_SSL: 'true' }),
  );
  assert.equal(options.type, 'postgres');
  assert.equal(options.synchronize, false);
  assert.equal(options.dropSchema, false);
  assert.equal(options.migrationsRun, false);
  assert.equal(options.logging, false);
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
  assert.deepEqual(options.invalidWhereValuesBehavior, {
    null: 'throw',
    undefined: 'throw',
  });
});

test('default delivery company is optional and validates BIGINT strings without precision loss', () => {
  assert.equal(validateEnvironment(input).DEFAULT_DELIVERY_COMPANY_ID, null);
  assert.equal(
    validateEnvironment({
      ...input,
      DEFAULT_DELIVERY_COMPANY_ID: '9223372036854775807',
    }).DEFAULT_DELIVERY_COMPANY_ID,
    '9223372036854775807',
  );
  for (const value of ['0', '-1', '1.5', '9223372036854775808', 1])
    assert.throws(() =>
      validateEnvironment({ ...input, DEFAULT_DELIVERY_COMPANY_ID: value }),
    );
});
