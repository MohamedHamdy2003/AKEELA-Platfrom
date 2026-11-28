/**
 * Bounded in-memory fixed-window rate limiter with amortized O(1) checks.
 * Sweeps expired entries at most once per `sweepIntervalMs` instead of scanning
 * the entire map on every request when active keys exceed 1,000.
 */
export class FixedWindowRateLimiter {
  private readonly entries = new Map<
    string,
    { count: number; until: number }
  >();
  private lastSweepAt = 0;

  constructor(
    private readonly maxKeys: number,
    private readonly sweepIntervalMs = 10_000,
  ) {}

  private sweepExpired(now: number, force = false): void {
    if (!force && now - this.lastSweepAt < this.sweepIntervalMs) return;
    this.lastSweepAt = now;
    for (const [key, entry] of this.entries) {
      if (entry.until <= now) this.entries.delete(key);
    }
  }

  /**
   * Check whether `key` is already at or above `limit` without mutating counters.
   * Returns `retryAfterSeconds` if blocked, or `0` if allowed.
   */
  peekBlocked(key: string, limit: number, now = Date.now()): number {
    const current = this.entries.get(key);
    if (!current || current.until <= now) return 0;
    if (current.count >= limit) {
      return Math.max(1, Math.ceil((current.until - now) / 1000));
    }
    return 0;
  }

  /**
   * Atomically check and increment `key`.
   * Returns `{ allowed: true, retryAfterSeconds: 0 }` or `{ allowed: false, retryAfterSeconds }`.
   */
  consume(
    key: string,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): { allowed: boolean; retryAfterSeconds: number } {
    if (this.entries.size > 1_000) {
      this.sweepExpired(now);
    }
    const current = this.entries.get(key);
    const active = current && current.until > now ? current : undefined;
    if (active && active.count >= limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((active.until - now) / 1000)),
      };
    }
    if (!active && this.entries.size >= this.maxKeys) {
      this.sweepExpired(now, true);
      if (this.entries.size >= this.maxKeys) {
        const oldest = this.entries.keys().next().value;
        if (oldest !== undefined) this.entries.delete(oldest);
      }
    }
    this.entries.delete(key);
    this.entries.set(key, {
      count: (active?.count ?? 0) + 1,
      until: active?.until ?? now + windowMs,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  clear(): void {
    this.entries.clear();
  }
}
