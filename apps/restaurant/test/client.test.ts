import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient, ApiError, errorMessage } from '../src/lib/api.ts';
import { cairoISO, cairoLocal, money, sumMoney } from '../src/lib/format.ts';

const tokens = {
  access_token: 'first',
  refresh_token: 'refresh-test-only',
  expires_in: 900,
  refresh_expires_in: 1000,
};
const reply = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify(
      status === 200
        ? { success: true, data }
        : { success: false, error: { code: 'UNAUTHENTICATED' } },
    ),
    { status },
  );
test('concurrent expired requests rotate once, retry with the fresh access token', async () => {
  let rotations = 0;
  let reads = 0;
  const fetcher: typeof fetch = async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) {
      rotations++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return reply({ ...tokens, access_token: 'new' });
    }
    reads++;
    return (init?.headers as Record<string, string>).Authorization ===
      'Bearer new'
      ? reply({ ok: true })
      : reply(null, 401);
  };
  const client = new ApiClient('/api/v1', fetcher);
  client.setSession(tokens);
  const result = await Promise.all([
    client.request('/me'),
    client.request('/restaurant/profile'),
  ]);
  assert.equal(rotations, 1);
  assert.equal(reads, 4);
  assert.equal(result[1].success, true);
});
test('failed rotation ends session with no retry loop', async () => {
  let calls = 0;
  let ended = 0;
  const client = new ApiClient('/api/v1', async () => {
    calls++;
    return reply(null, 401);
  });
  client.onSessionEnd = () => {
    ended++;
  };
  client.setSession(tokens);
  await assert.rejects(client.request('/me'), ApiError);
  assert.equal(calls, 2);
  assert.equal(ended, 1);
});
test('logout during refresh cannot restore revoked local session', async () => {
  let finish: ((response: Response) => void) | undefined;
  const client = new ApiClient('/api/v1', async (url) =>
    String(url).endsWith('/auth/refresh')
      ? new Promise<Response>((resolve) => {
          finish = resolve;
        })
      : reply(null, 401),
  );
  client.setSession(tokens);
  const pending = client.request('/me');
  await new Promise((resolve) => setTimeout(resolve, 0));
  client.clearSession();
  finish!(reply({ ...tokens, access_token: 'late' }));
  await assert.rejects(pending, ApiError);
});
test('wrong credentials on login reports invalid email or password instead of expired session', async () => {
  const client = new ApiClient('/api/v1', async () => reply(null, 401));
  await assert.rejects(
    client.login('wrong@example.com', 'WrongPass1'),
    (error: unknown) =>
      error instanceof ApiError &&
      error.code === 'INVALID_CREDENTIALS' &&
      errorMessage(error) === 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
  );
});
test('wrong role never opens restaurant workspace and revokes returned session', async () => {
  const calls: string[] = [];
  const client = new ApiClient('/api/v1', async (url) => {
    calls.push(String(url));
    return reply({ user: { role: 'Admin' }, tokens });
  });
  await assert.rejects(
    client.login('test@example.com', 'test-only'),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'WRONG_ROLE',
  );
  assert.deepEqual(calls, ['/api/v1/auth/login', '/api/v1/auth/logout']);
});
test('Cairo datetime conversion ignores machine timezone and observes summer/winter', () => {
  assert.equal(cairoISO('2026-01-10T12:00'), '2026-01-10T10:00:00.000Z');
  assert.equal(cairoISO('2026-07-10T12:00'), '2026-07-10T09:00:00.000Z');
  assert.equal(cairoLocal('2026-07-10T09:00:00Z'), '2026-07-10T12:00');
  assert.throws(() => cairoISO('2026-02-30T12:00'));
  assert.throws(() => cairoISO('2026-04-24T00:30'));
  assert.throws(() => cairoISO('2026-10-29T23:30'));
});
test('money is formatted and summed without floating point or BIGINT precision loss', () => {
  assert.equal(sumMoney(['9999999999.99', '0.01']), '10000000000.00');
  assert.equal(sumMoney(['0.10', '0.20']), '0.30');
  assert.equal(money('10000000000.00'), '10,000,000,000.00 ج.م');
});
