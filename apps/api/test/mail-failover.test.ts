import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { validateEnvironment } from '../src/config/environment';
import {
  classifyMailError,
  FailoverMailProvider,
} from '../src/modules/auth/mail/failover-mail.provider';
import type {
  MailProvider,
  OutgoingMail,
} from '../src/modules/auth/mail/mail-provider.interface';

const envBase = {
  DATABASE_URL: 'postgresql://localhost/akeela_test',
  JWT_SECRET: 'test-only-jwt-secret-012345678901234567890',
  OTP_SECRET: 'test-only-otp-secret-012345678901234567890',
};

const sampleMail: OutgoingMail = {
  to: 'customer@example.com',
  subject: 'AKEELA Verify',
  text: 'Your AKEELA code is 123456.',
};

function stubProvider(
  name: string,
  handler: (message: OutgoingMail) => Promise<void>,
) {
  let calls = 0;
  let closed = false;
  const provider: MailProvider = {
    name,
    async send(message) {
      calls += 1;
      await handler(message);
    },
    async verify() {},
    close() {
      closed = true;
    },
  };
  return {
    provider,
    get calls() {
      return calls;
    },
    get closed() {
      return closed;
    },
  };
}

test('FailoverMailProvider switches to fallback on quota exhaustion, cools down primary, and recovers automatically', async () => {
  let clock = 1_000_000;
  let primaryOverQuota = true;

  const resend = stubProvider('resend', async () => {
    if (primaryOverQuota) {
      const error = Object.assign(new Error('Daily sending quota exceeded'), {
        responseCode: 429,
      });
      throw error;
    }
  });
  const brevo = stubProvider('brevo', async () => {});

  const failover = new FailoverMailProvider([resend.provider, brevo.provider], {
    quotaCooldownMs: 60_000,
    transientCooldownMs: 10_000,
    now: () => clock,
  });

  // 1st send hits Resend quota -> seamlessly falls back to Brevo
  await failover.send(sampleMail);
  assert.equal(resend.calls, 1);
  assert.equal(brevo.calls, 1);

  // 2nd send during cooldown skips Resend completely -> straight to Brevo
  clock += 30_000;
  await failover.send(sampleMail);
  assert.equal(resend.calls, 1);
  assert.equal(brevo.calls, 2);

  // After cooldown expires, Resend is retried and takes over again
  clock += 31_000;
  primaryOverQuota = false;
  await failover.send(sampleMail);
  assert.equal(resend.calls, 2);
  assert.equal(brevo.calls, 2);

  failover.close();
  assert.equal(resend.closed, true);
  assert.equal(brevo.closed, true);
});

test('FailoverMailProvider supports multi-provider chains and falls back across transient failures', async () => {
  let clock = 5_000_000;
  const first = stubProvider('resend', async () => {
    throw Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' });
  });
  const second = stubProvider('brevo', async () => {
    throw Object.assign(new Error('Daily limit reached'), {
      responseCode: 452,
    });
  });
  const third = stubProvider('gmail', async () => {});

  const failover = new FailoverMailProvider(
    [first.provider, second.provider, third.provider],
    { now: () => clock },
  );

  await failover.send(sampleMail);
  assert.equal(first.calls, 1);
  assert.equal(second.calls, 1);
  assert.equal(third.calls, 1);

  // Subsequent send skips both cooling providers and goes straight to 3rd
  clock += 1_000;
  await failover.send(sampleMail);
  assert.equal(first.calls, 1);
  assert.equal(second.calls, 1);
  assert.equal(third.calls, 2);
});

test('FailoverMailProvider does not burn fallback quota on invalid recipient errors and still retries if all providers are cooling', async () => {
  let clock = 9_000_000;
  const primary = stubProvider('resend', async () => {
    throw Object.assign(new Error('550 5.1.1 User unknown'), {
      responseCode: 550,
    });
  });
  const fallback = stubProvider('brevo', async () => {});

  const failover = new FailoverMailProvider(
    [primary.provider, fallback.provider],
    { now: () => clock },
  );

  assert.equal(
    classifyMailError({ responseCode: 550, message: '5.1.1 User unknown' }),
    'recipient',
  );
  await assert.rejects(() => failover.send(sampleMail));
  assert.equal(primary.calls, 1);
  assert.equal(fallback.calls, 0);

  // Safety net: even when all providers are cooling, a send still attempts the earliest-expiring one.
  let recoverFirst = false;
  const p1 = stubProvider('resend', async () => {
    if (!recoverFirst)
      throw Object.assign(new Error('Network down'), { code: 'ECONNECTION' });
  });
  const p2 = stubProvider('brevo', async () => {
    throw Object.assign(new Error('Daily quota exceeded'), {
      responseCode: 429,
    });
  });
  const allCooling = new FailoverMailProvider([p1.provider, p2.provider], {
    transientCooldownMs: 10_000,
    quotaCooldownMs: 60_000,
    now: () => clock,
  });
  await assert.rejects(() => allCooling.send(sampleMail));
  assert.equal(p1.calls, 1);
  assert.equal(p2.calls, 1);

  recoverFirst = true;
  clock += 1_000;
  await allCooling.send(sampleMail);
  assert.equal(p1.calls, 2);
});

test('FailoverMailProvider handles recipient mailbox-quota 550, same-vendor slot isolation, and cooling last-resort fallback', async () => {
  let clock = 20_000_000;

  // 1) 550 5.2.2 recipient mailbox quota must be treated as recipient error, NOT provider quota exhaustion
  assert.equal(
    classifyMailError({
      responseCode: 550,
      message: '5.2.2 Mailbox quota exceeded for recipient',
    }),
    'recipient',
  );
  // Word-boundary quota classification should not falsely trigger on substrings like "moderate" or "separate"
  assert.equal(
    classifyMailError({
      responseCode: 450,
      message: 'Temporary separate relay error',
    }),
    'transient',
  );

  // 2) Two same-vendor providers ('gmail' and 'gmail') track cooldowns independently by slot
  const gmailA = stubProvider('gmail', async () => {
    throw Object.assign(new Error('Daily quota exceeded'), {
      responseCode: 429,
    });
  });
  const gmailB = stubProvider('gmail', async () => {});
  const sameVendor = new FailoverMailProvider(
    [gmailA.provider, gmailB.provider],
    { quotaCooldownMs: 60_000, now: () => clock },
  );
  await sameVendor.send(sampleMail);
  assert.equal(gmailA.calls, 1);
  assert.equal(gmailB.calls, 1);

  clock += 1_000;
  await sameVendor.send(sampleMail);
  // gmailA is cooling, gmailB is active and served immediately
  assert.equal(gmailA.calls, 1);
  assert.equal(gmailB.calls, 2);

  // 3) When active fallback fails during primary's cooldown, primary is still retried as a last resort
  let primaryRecovered = false;
  let secondaryDown = false;
  const pPrimary = stubProvider('resend', async () => {
    if (!primaryRecovered) {
      throw Object.assign(new Error('Connection timeout'), {
        code: 'ETIMEDOUT',
      });
    }
  });
  const pSecondary = stubProvider('brevo', async () => {
    if (secondaryDown) {
      throw Object.assign(new Error('Daily limit exceeded'), {
        responseCode: 429,
      });
    }
  });
  const lastResort = new FailoverMailProvider(
    [pPrimary.provider, pSecondary.provider],
    { transientCooldownMs: 60_000, quotaCooldownMs: 60_000, now: () => clock },
  );
  await lastResort.send(sampleMail); // primary fails -> cools down, secondary delivers
  assert.equal(pPrimary.calls, 1);
  assert.equal(pSecondary.calls, 1);

  primaryRecovered = true;
  secondaryDown = true;
  clock += 1_000;
  await lastResort.send(sampleMail); // secondary fails -> cooling primary tried as last resort & succeeds
  assert.equal(pPrimary.calls, 2);
  assert.equal(pSecondary.calls, 2);
});

test('environment validates multi-provider SMTP configuration for Resend, Brevo, and optional 3rd fallback', () => {
  const config = validateEnvironment({
    ...envBase,
    NODE_ENV: 'production',
    PUBLIC_BASE_URL: 'https://api.akeelaonline.tech',
    SMTP_HOST: 'smtp.resend.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_REQUIRE_TLS: 'true',
    SMTP_USER: 'resend',
    SMTP_PASSWORD: 're_test_api_key_value',
    SMTP_FROM: 'AKEELA <noreply@mail.akeelaonline.tech>',
    SMTP_FALLBACK_HOST: 'smtp-relay.brevo.com',
    SMTP_FALLBACK_PORT: '587',
    SMTP_FALLBACK_SECURE: 'false',
    SMTP_FALLBACK_REQUIRE_TLS: 'true',
    SMTP_FALLBACK_USER: 'brevo-login@smtp-brevo.com',
    SMTP_FALLBACK_PASSWORD: 'xsmtpsib-test-key',
    SMTP_FALLBACK_FROM: '',
    SMTP_FALLBACK_2_HOST: 'smtp.gmail.com',
    SMTP_FALLBACK_2_PORT: '465',
    SMTP_FALLBACK_2_SECURE: 'true',
    SMTP_FALLBACK_2_REQUIRE_TLS: 'true',
    SMTP_FALLBACK_2_USER: 'backup@gmail.com',
    SMTP_FALLBACK_2_PASSWORD: 'abcd efgh ijkl mnop',
    SMTP_FALLBACK_2_FROM: 'AKEELA <backup@gmail.com>',
  });

  assert.equal(config.SMTP_PROVIDERS.length, 3);
  assert.equal(config.SMTP_PROVIDERS[0]!.name, 'resend');
  assert.equal(
    config.SMTP_PROVIDERS[0]!.from,
    'AKEELA <noreply@mail.akeelaonline.tech>',
  );
  assert.equal(config.SMTP_PROVIDERS[1]!.name, 'brevo');
  assert.equal(
    config.SMTP_PROVIDERS[1]!.from,
    'AKEELA <noreply@mail.akeelaonline.tech>',
    'Fallback should inherit SMTP_FROM when SMTP_FALLBACK_FROM is blank',
  );
  assert.equal(config.SMTP_PROVIDERS[2]!.name, 'gmail');
  assert.equal(config.SMTP_PROVIDERS[2]!.password, 'abcdefghijklmnop');

  // Rejects production cleartext fallback or mismatched credentials
  assert.throws(() =>
    validateEnvironment({
      ...envBase,
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://api.akeelaonline.tech',
      SMTP_HOST: 'smtp.resend.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'resend',
      SMTP_PASSWORD: 're_test_api_key_value',
      SMTP_FROM: 'AKEELA <noreply@mail.akeelaonline.tech>',
      SMTP_FALLBACK_HOST: 'smtp-relay.brevo.com',
      SMTP_FALLBACK_PORT: '587',
      SMTP_FALLBACK_SECURE: 'false',
      SMTP_FALLBACK_REQUIRE_TLS: 'false',
      SMTP_FALLBACK_USER: 'brevo-user',
      SMTP_FALLBACK_PASSWORD: 'brevo-password',
    }),
  );
  assert.throws(() =>
    validateEnvironment({
      ...envBase,
      SMTP_FALLBACK_HOST: 'smtp-relay.brevo.com',
      SMTP_FALLBACK_USER: 'only-user',
    }),
  );
});
