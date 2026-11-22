import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, validateEnvironment } from '../src/config/environment';
import { AuthCryptoService } from '../src/modules/auth/auth-crypto.service';
import { AuthRateLimitGuard } from '../src/modules/auth/auth-rate-limit.guard';
import { ApiError } from '../src/common/http/api-error';

const settings = validateEnvironment({
  DATABASE_URL: 'postgresql://localhost/akeela_test',
  JWT_SECRET: 'test-only-jwt-012345678901234567890123456',
  OTP_SECRET: 'test-only-otp-012345678901234567890123456',
  AUTH_RATE_IP_LIMIT: '2',
  AUTH_RATE_ACCOUNT_LIMIT: '1',
});
const config = new ConfigService<Environment, true>(settings);

test('password hashes use a random salt, verify correctly, and do not truncate passwords', async () => {
  const crypto = new AuthCryptoService(config);
  const password = 'A long test password with spaces and unicode: مرحبا';
  const first = await crypto.hashPassword(password);
  const second = await crypto.hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await crypto.verifyPassword(password, first), true);
  assert.equal(await crypto.verifyPassword(password + 'x', first), false);
  assert.equal(await crypto.verifyPassword(password, null), false);
  assert.equal(
    await crypto.verifyPassword(password, 'scrypt$99999999$8$1$bad$bad'),
    false,
  );
});

test('OTP hashes bind both user and purpose; refresh tokens are random opaque values', () => {
  const crypto = new AuthCryptoService(config);
  const hash = crypto.otpHash('1', 'Email_Verification', '012345');
  assert.equal(
    crypto.matchesOtp('1', 'Email_Verification', '012345', hash),
    true,
  );
  assert.equal(
    crypto.matchesOtp('2', 'Email_Verification', '012345', hash),
    false,
  );
  assert.equal(crypto.matchesOtp('1', 'Password_Reset', '012345', hash), false);
  assert.equal(
    crypto.matchesOtp('1', 'Email_Verification', '012345', 'bad'),
    false,
  );
  assert.match(crypto.newOtp(), /^\d{6}$/);
  assert.match(crypto.newRefresh(), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(crypto.newRefresh(), crypto.newRefresh());
});

function context(
  ip: string,
  email: string | undefined,
  headers: Record<string, unknown>,
  actorUserId?: string,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        ip,
        body: email !== undefined ? { email } : {},
        ...(actorUserId
          ? {
              actor: {
                userId: actorUserId,
                sessionId: '00000000-0000-4000-8000-000000000001',
                role: 'Customer',
              },
            }
          : {}),
      }),
      getResponse: () => ({
        setHeader: (key: string, value: unknown) => {
          headers[key] = value;
        },
      }),
    }),
  } as unknown as ExecutionContext;
}
test('auth account limit applies across IPs and emits Retry-After', () => {
  const guard = new AuthRateLimitGuard(config);
  const headers: Record<string, unknown> = {};
  assert.equal(
    guard.canActivate(context('127.0.0.1', 'Alice@EXAMPLE.COM', headers)),
    true,
  );
  assert.throws(
    () =>
      guard.canActivate(context('127.0.0.2', ' alice@example.com ', headers)),
    (error: unknown) => error instanceof ApiError && error.getStatus() === 429,
  );
  assert.ok(Number(headers['Retry-After']) > 0);
});
test('auth account limit applies to authenticated actor routes without email body (e.g. PATCH /me/password)', () => {
  const guard = new AuthRateLimitGuard(config);
  const headers: Record<string, unknown> = {};
  assert.equal(
    guard.canActivate(context('127.0.0.1', undefined, headers, '42')),
    true,
  );
  assert.throws(
    () => guard.canActivate(context('127.0.0.2', undefined, headers, '42')),
    (error: unknown) => error instanceof ApiError && error.getStatus() === 429,
  );
  assert.ok(Number(headers['Retry-After']) > 0);
});
test('auth IP limit applies even when attackers change email addresses', () => {
  const guard = new AuthRateLimitGuard(config);
  const headers: Record<string, unknown> = {};
  guard.canActivate(context('127.0.0.1', 'one@example.com', headers));
  guard.canActivate(context('127.0.0.1', 'two@example.com', headers));
  assert.throws(
    () => guard.canActivate(context('127.0.0.1', 'three@example.com', headers)),
    (error: unknown) => error instanceof ApiError && error.getStatus() === 429,
  );
});

test('auth configuration rejects missing/reused secrets and production cleartext SMTP', () => {
  const base = {
    DATABASE_URL: 'postgresql://localhost/akeela_test',
    JWT_SECRET: settings.JWT_SECRET,
    OTP_SECRET: settings.OTP_SECRET,
  };
  assert.throws(() => validateEnvironment({ ...base, JWT_SECRET: '' }));
  assert.throws(() =>
    validateEnvironment({ ...base, OTP_SECRET: settings.JWT_SECRET }),
  );
  assert.throws(() =>
    validateEnvironment({
      ...base,
      NODE_ENV: 'production',
      SMTP_REQUIRE_TLS: 'false',
      SMTP_SECURE: 'false',
    }),
  );
  assert.throws(() => validateEnvironment({ ...base, OTP_MAX_ATTEMPTS: '0' }));
  assert.throws(() =>
    validateEnvironment({ ...base, SMTP_USER: 'user', SMTP_PASSWORD: '' }),
  );
});
