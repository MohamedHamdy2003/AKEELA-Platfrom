import type { Tokens } from './models.ts';

export interface SessionStore {
  read(): Tokens | null;
  write(tokens: Tokens): void;
  clear(): void;
}

// Each origin/tab owns its session. No user/profile data is cached here.
export function browserSessionStore(base: string, role: string): SessionStore {
  const key = `akeela.session:${role}:${base.replace(/\/$/, '')}`;
  const clear = () => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Storage can be disabled by the browser; memory sessions still work.
    }
  };
  return {
    read() {
      try {
        const value: unknown = JSON.parse(
          window.sessionStorage.getItem(key) ?? 'null',
        );
        if (
          value &&
          typeof value === 'object' &&
          'access_token' in value &&
          typeof value.access_token === 'string' &&
          value.access_token &&
          'refresh_token' in value &&
          typeof value.refresh_token === 'string' &&
          value.refresh_token &&
          'expires_in' in value &&
          typeof value.expires_in === 'number' &&
          Number.isFinite(value.expires_in) &&
          value.expires_in > 0 &&
          'refresh_expires_in' in value &&
          typeof value.refresh_expires_in === 'number' &&
          Number.isFinite(value.refresh_expires_in) &&
          value.refresh_expires_in > 0
        )
          return value as Tokens;
      } catch {
        // Corrupt or unavailable storage must not stop the login screen.
      }
      clear();
      return null;
    },
    write(tokens) {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(tokens));
      } catch {
        clear();
      }
    },
    clear,
  };
}
