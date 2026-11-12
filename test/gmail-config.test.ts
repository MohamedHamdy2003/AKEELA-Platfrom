import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEnvironment } from '../src/config/environment';
import { smtpOptions } from '../src/modules/auth/smtp.options';

const base = {
  DATABASE_URL: 'postgresql://localhost/akeela_test',
  JWT_SECRET: 'test-only-jwt-secret-012345678901234567890',
  OTP_SECRET: 'test-only-otp-secret-012345678901234567890',
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_REQUIRE_TLS: 'true',
  SMTP_USER: 'sender@gmail.com',
  SMTP_PASSWORD: 'abcd efgh ijkl mnop',
  SMTP_FROM: 'AKEELA <sender@gmail.com>',
};
test('Gmail config normalizes App Password spaces and creates an encrypted real SMTP transport', () => {
  const config = validateEnvironment(base);
  assert.equal(config.SMTP_PASSWORD, 'abcdefghijklmnop');
  const options = smtpOptions(config);
  assert.equal(options.host, 'smtp.gmail.com');
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.requireTLS, true);
  assert.equal(options.auth?.user, 'sender@gmail.com');
  assert.equal(options.debug, false);
  assert.equal(options.logger, false);
});
test('Gmail rejects missing credentials, sender mismatch, bad App Password and unsafe TLS settings', () => {
  for (const changes of [
    { SMTP_USER: '', SMTP_PASSWORD: '' },
    { SMTP_PASSWORD: 'short' },
    { SMTP_FROM: 'Someone <other@gmail.com>' },
    { SMTP_FROM: 'sender@gmail.com\r\nBcc: other@example.com' },
    { SMTP_SECURE: 'false' },
    { SMTP_PORT: '25' },
    { SMTP_PORT: '587', SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'false' },
  ])
    assert.throws(() => validateEnvironment({ ...base, ...changes }));
});
test('Gmail also supports port 587 with mandatory STARTTLS; generic SMTP passwords are unchanged', () => {
  assert.equal(
    validateEnvironment({ ...base, SMTP_PORT: '587', SMTP_SECURE: 'false' })
      .SMTP_REQUIRE_TLS,
    true,
  );
  assert.equal(
    validateEnvironment({
      ...base,
      SMTP_HOST: 'localhost',
      SMTP_PASSWORD: 'password with spaces',
    }).SMTP_PASSWORD,
    'password with spaces',
  );
});
