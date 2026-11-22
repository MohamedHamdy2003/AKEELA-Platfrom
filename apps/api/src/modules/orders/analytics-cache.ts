import type { DataSource } from 'typeorm';
import type { AnalyticsRange } from './orders.dto';

export interface AnalyticsWindow {
  todayIso: string;
  startIso: string | null;
  since: Date | null;
  prevSince: Date | null;
  days: number | null;
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  return dt.toISOString().slice(0, 10);
}

/**
 * Resolve Cairo calendar window bounds in a single SQL round-trip.
 */
export async function resolveCairoAnalyticsWindow(
  db: DataSource,
  range: AnalyticsRange,
): Promise<AnalyticsWindow> {
  if (range === 'all') {
    const [{ today_iso }] = (await db.query(
      "SELECT to_char((NOW() AT TIME ZONE 'Africa/Cairo')::date, 'YYYY-MM-DD') AS today_iso",
    )) as [{ today_iso: string }];
    return {
      todayIso: today_iso,
      startIso: null,
      since: null,
      prevSince: null,
      days: null,
    };
  }

  const days =
    range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;

  const [{ today_iso, start_iso, since, prev_since }] = (await db.query(
    `WITH bounds AS (
      SELECT (NOW() AT TIME ZONE 'Africa/Cairo')::date AS today_date
    )
    SELECT
      to_char(today_date, 'YYYY-MM-DD') AS today_iso,
      to_char(today_date - ($1::int - 1), 'YYYY-MM-DD') AS start_iso,
      ((today_date - ($1::int - 1))::timestamp AT TIME ZONE 'Africa/Cairo') AS since,
      ((today_date - ($1::int * 2 - 1))::timestamp AT TIME ZONE 'Africa/Cairo') AS prev_since
    FROM bounds`,
    [days],
  )) as [
    {
      today_iso: string;
      start_iso: string;
      since: Date;
      prev_since: Date;
    },
  ];

  return {
    todayIso: today_iso,
    startIso: start_iso,
    since: new Date(since),
    prevSince: new Date(prev_since),
    days,
  };
}

/**
 * Short-TTL in-memory cache with in-flight request coalescing for heavy analytics overviews.
 * Automatically bypassed in NODE_ENV=test so integration tests observe immediate writes.
 */
export class AnalyticsCache {
  private readonly entries = new Map<
    string,
    { expiresAt: number; value: unknown }
  >();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly ttlMs = 20_000,
    private readonly maxEntries = 500,
  ) {}

  async getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
    if (process.env.NODE_ENV === 'test') {
      return loader();
    }

    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }
    if (cached) {
      this.entries.delete(key);
    }

    const pending = this.inflight.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    const promise = loader()
      .then((value) => {
        if (this.entries.size >= this.maxEntries) {
          for (const [entryKey, entry] of this.entries) {
            if (entry.expiresAt <= Date.now()) this.entries.delete(entryKey);
          }
          if (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest !== undefined) this.entries.delete(oldest);
          }
        }
        this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, value });
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }
}
