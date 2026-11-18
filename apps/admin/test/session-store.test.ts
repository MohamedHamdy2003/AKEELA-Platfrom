import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserSessionStore } from '../../../packages/portal/src/session-store.ts';

test('browser storage isolates app/API sessions, removes corrupt data and tolerates disabled storage', () => {
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const tokens = {
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_in: 900,
    refresh_expires_in: 1000,
  };
  try {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => {
            values.set(key, value);
          },
          removeItem: (key: string) => {
            values.delete(key);
          },
        },
      },
    });
    const admin = browserSessionStore('/api/v1', 'Admin');
    admin.write(tokens);
    assert.deepEqual(admin.read(), tokens);
    assert.equal(browserSessionStore('/api/v1', 'Restaurant').read(), null);
    assert.equal(
      browserSessionStore('https://other.invalid/api/v1', 'Admin').read(),
      null,
    );
    for (const invalid of [
      '{bad',
      '{}',
      'null',
      JSON.stringify({ ...tokens, expires_in: 0 }),
      JSON.stringify({ ...tokens, access_token: '' }),
    ]) {
      values.set('akeela.session:Admin:/api/v1', invalid);
      assert.equal(admin.read(), null);
      assert.equal(values.size, 0);
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get() {
        throw new Error('Storage blocked');
      },
    });
    assert.doesNotThrow(() => admin.write(tokens));
    assert.equal(admin.read(), null);
    assert.doesNotThrow(() => admin.clear());
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
