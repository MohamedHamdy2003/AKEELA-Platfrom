import assert from 'node:assert/strict';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { validateEnvironment } from '../src/config/environment';
import {
  createServiceAccountAssertion,
  FcmHttpV1Transport,
} from '../src/modules/notifications/fcm.client';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://akeela:secret@localhost:5432/akeela_test',
  JWT_SECRET: 'a'.repeat(32),
  OTP_SECRET: 'b'.repeat(32),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  SMTP_SECURE: 'false',
  SMTP_REQUIRE_TLS: 'false',
  SMTP_FROM: 'AKEELA <noreply@example.com>',
};

test('environment accepts empty FCM config, normalizes escaped PEM newlines, and rejects partial config', () => {
  const disabled = validateEnvironment(baseEnv);
  assert.equal(disabled.FCM_PROJECT_ID, null);
  assert.equal(disabled.FCM_CLIENT_EMAIL, null);
  assert.equal(disabled.FCM_PRIVATE_KEY, null);

  assert.throws(
    () =>
      validateEnvironment({
        ...baseEnv,
        FCM_PROJECT_ID: 'akeela-prod',
      }),
    /must all be set together/,
  );

  assert.throws(
    () =>
      validateEnvironment({
        ...baseEnv,
        FCM_PROJECT_ID: 'akeela-prod',
        FCM_CLIENT_EMAIL: 'fcm@akeela-prod.iam.gserviceaccount.com',
        FCM_PRIVATE_KEY: 'not-a-pem-key',
      }),
    /PEM-formatted private key/,
  );

  const escapedKey = privateKey.replace(/\n/g, '\\n');
  const enabled = validateEnvironment({
    ...baseEnv,
    FCM_PROJECT_ID: 'akeela-prod',
    FCM_CLIENT_EMAIL: 'fcm@akeela-prod.iam.gserviceaccount.com',
    FCM_PRIVATE_KEY: escapedKey,
  });
  assert.equal(enabled.FCM_PROJECT_ID, 'akeela-prod');
  assert.equal(
    enabled.FCM_CLIENT_EMAIL,
    'fcm@akeela-prod.iam.gserviceaccount.com',
  );
  assert.ok(enabled.FCM_PRIVATE_KEY?.includes('\n'));
});

test('createServiceAccountAssertion mints a valid RS256 Google OAuth2 JWT', () => {
  const jwt = createServiceAccountAssertion(
    {
      projectId: 'akeela-prod',
      clientEmail: 'fcm@akeela-prod.iam.gserviceaccount.com',
      privateKey,
    },
    1_700_000_000,
  );
  const parts = jwt.split('.');
  assert.equal(parts.length, 3);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const sig = Buffer.from(
    parts[2]!.replace(/-/g, '+').replace(/_/g, '/'),
    'base64',
  );
  assert.equal(verifier.verify(publicKey, sig), true);

  const payload = JSON.parse(
    Buffer.from(
      parts[1]!.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8'),
  ) as Record<string, unknown>;
  assert.equal(payload.iss, 'fcm@akeela-prod.iam.gserviceaccount.com');
  assert.equal(
    payload.scope,
    'https://www.googleapis.com/auth/firebase.messaging',
  );
  assert.equal(payload.exp, 1_700_003_600);
});

test('FcmHttpV1Transport caches OAuth2 tokens, sends v1 payloads, and flags UNREGISTERED tokens for pruning', async () => {
  let oauthCalls = 0;
  const sentBodies: Array<Record<string, unknown>> = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === 'https://oauth2.googleapis.com/token') {
      oauthCalls += 1;
      return new Response(
        JSON.stringify({ access_token: 'ya29.test-token', expires_in: 3600 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    assert.equal(
      url,
      'https://fcm.googleapis.com/v1/projects/akeela-prod/messages:send',
    );
    const body = JSON.parse(String(init?.body ?? '{}')) as {
      message: { token: string };
    };
    sentBodies.push(body as Record<string, unknown>);
    if (body.message.token === 'dead-token-12345678901234567890') {
      return new Response(
        JSON.stringify({
          error: {
            code: 404,
            status: 'NOT_FOUND',
            details: [{ errorCode: 'UNREGISTERED' }],
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return new Response(
      JSON.stringify({ name: 'projects/akeela-prod/messages/msg-1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const transport = new FcmHttpV1Transport(
    {
      projectId: 'akeela-prod',
      clientEmail: 'fcm@akeela-prod.iam.gserviceaccount.com',
      privateKey,
    },
    mockFetch,
  );

  const okRes = await transport.send({
    token: 'live-token-12345678901234567890',
    title: 'طلب جديد #55',
    body: 'تم قبول طلبك.',
    data: { order_id: '55', status: 'Accepted' },
  });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.messageId, 'projects/akeela-prod/messages/msg-1');

  const deadRes = await transport.send({
    token: 'dead-token-12345678901234567890',
    title: 'تنبيه',
    body: 'تجربة',
  });
  assert.equal(deadRes.ok, false);
  assert.equal(deadRes.unregister, true);
  assert.equal(deadRes.errorCode, 'UNREGISTERED');

  // OAuth token should be exchanged only once and reused from cache.
  assert.equal(oauthCalls, 1);
  assert.equal(sentBodies.length, 2);
});
