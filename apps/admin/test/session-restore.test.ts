import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient as PortalClient } from '../../../packages/portal/src/api.ts';
import { ApiClient as RestaurantClient } from '../../restaurant/src/lib/api.ts';
import type { SessionStore } from '../../../packages/portal/src/session-store.ts';
import type { Tokens } from '../../../packages/portal/src/models.ts';

const tokens: Tokens = {
  access_token: 'test-access',
  refresh_token: 'test-refresh',
  expires_in: 900,
  refresh_expires_in: 2592000,
};
const reply = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status === 200,
      data,
      error: status === 200 ? undefined : { code: 'UNAUTHENTICATED' },
    }),
    { status },
  );
function memoryStore() {
  let value: Tokens | null = tokens;
  return {
    read: () => value,
    write: (next: Tokens) => {
      value = next;
    },
    clear: () => {
      value = null;
    },
  } satisfies SessionStore;
}

for (const role of ['Admin', 'Delivery_Company', 'Restaurant'] as const) {
  const create = (fetcher: typeof fetch, store: SessionStore) =>
    role === 'Restaurant'
      ? new RestaurantClient('/api/v1', fetcher, store)
      : new PortalClient('/api/v1', role, fetcher, store);
  test(`${role}: concurrent bootstrap checks the server once and persists rotated tokens for next reload`, async () => {
    const store = memoryStore();
    let rotations = 0,
      reads = 0;
    const fetcher: typeof fetch = async (url, options) => {
      if (String(url).endsWith('/auth/refresh')) {
        rotations++;
        return reply({
          ...tokens,
          access_token: 'new-access',
          refresh_token: 'new-refresh',
        });
      }
      reads++;
      return (options?.headers as Record<string, string>).Authorization ===
        'Bearer new-access'
        ? reply({ role, full_name: 'Current server name' })
        : reply(null, 401);
    };
    const client = create(fetcher, store);
    const [first, second] = await Promise.all([
      client.restoreSession(),
      client.restoreSession(),
    ]);
    assert.equal(first?.full_name, 'Current server name');
    assert.equal(second?.role, role);
    assert.equal(rotations, 1);
    assert.equal(reads, 2);
    assert.equal(store.read()?.refresh_token, 'new-refresh');
    assert.equal((await create(fetcher, store).restoreSession())?.role, role);
    assert.equal(rotations, 1);
  });
  test(`${role}: revoked sessions clear storage; wrong-role sessions cannot enter`, async () => {
    const revoked = memoryStore();
    assert.equal(
      await create(async () => reply(null, 401), revoked).restoreSession(),
      null,
    );
    assert.equal(revoked.read(), null);
    const wrongRole = memoryStore();
    assert.equal(
      await create(
        async () => reply({ role: 'Customer' }),
        wrongRole,
      ).restoreSession(),
      null,
    );
    assert.equal(wrongRole.read(), null);
  });
  test(`${role}: transient refresh failure preserves session and allows retry`, async () => {
    const store = memoryStore();
    let offline = true;
    const client = create(async (url) => {
      if (String(url).endsWith('/auth/refresh')) {
        if (offline) throw new Error('Test network loss');
        return reply(tokens);
      }
      return offline ? reply(null, 401) : reply({ role });
    }, store);
    await assert.rejects(client.restoreSession());
    assert.ok(store.read());
    offline = false;
    assert.equal((await client.restoreSession())?.role, role);
  });
  test(`${role}: logout during bootstrap cannot restore the local session`, async () => {
    const store = memoryStore();
    let finish!: (response: Response) => void;
    const client = create(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
      store,
    );
    const pending = client.restoreSession();
    client.clearSession();
    finish(reply({ role }));
    assert.equal(await pending, null);
    assert.equal(store.read(), null);
  });
  test(`${role}: a late unauthorized response cannot clear a newer login`, async () => {
    const store = memoryStore();
    let finish!: (response: Response) => void;
    const client = create(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
      store,
    );
    client.setSession(tokens);
    const pending = client.request('/me');
    client.setSession({ ...tokens, access_token: 'new-login' });
    finish(reply(null, 401));
    await assert.rejects(pending);
    assert.equal(store.read()?.access_token, 'new-login');
  });
}
