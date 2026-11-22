import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { Environment } from '../../config/environment';
import { ApiError } from '../../common/http/api-error';
import type { AuthActor } from '../../common/http/current-actor.decorator';

const MAX_TRACKED_KEYS = 10_000;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly ipCounters = new Map<
    string,
    { count: number; until: number }
  >();
  private readonly accountCounters = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(private readonly config: ConfigService<Environment, true>) {}

  private checkAndIncrement(
    map: Map<string, { count: number; until: number }>,
    key: string,
    limit: number,
    windowMs: number,
    now: number,
    response: Response,
  ): void {
    if (map.size > 1000) {
      for (const [entryKey, value] of map) {
        if (value.until <= now) map.delete(entryKey);
      }
    }
    const current = map.get(key);
    const active = current && current.until > now ? current : undefined;
    if (active && active.count >= limit) {
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((active.until - now) / 1000)),
      );
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many authentication requests. Try again later.',
      );
    }
    if (!active && map.size >= MAX_TRACKED_KEYS) {
      for (const [entryKey, value] of map) {
        if (value.until <= now) map.delete(entryKey);
      }
      if (map.size >= MAX_TRACKED_KEYS) {
        const oldest = map.keys().next().value;
        if (oldest !== undefined) map.delete(oldest);
      }
    }
    map.delete(key);
    map.set(key, {
      count: (active?.count ?? 0) + 1,
      until: active?.until ?? now + windowMs,
    });
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { actor?: AuthActor }>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    const windowMs =
      this.config.get('AUTH_RATE_WINDOW_SECONDS', { infer: true }) * 1000;
    const ipLimit = this.config.get('AUTH_RATE_IP_LIMIT', { infer: true });
    const accountLimit = this.config.get('AUTH_RATE_ACCOUNT_LIMIT', {
      infer: true,
    });

    const body = request.body as { email?: unknown } | undefined;
    const ipKey = `ip:${request.ip || 'unknown'}`;
    let accountKey: string | undefined;
    if (typeof body?.email === 'string' && body.email.trim()) {
      accountKey = `email:${createHash('sha256').update(body.email.trim().toLowerCase()).digest('hex')}`;
    } else if (request.actor?.userId) {
      accountKey = `user:${request.actor.userId}`;
    }

    // Check limits before incrementing either counter so a blocked account doesn't
    // consume extra IP quota or vice versa.
    const existingIp = this.ipCounters.get(ipKey);
    if (existingIp && existingIp.until > now && existingIp.count >= ipLimit) {
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((existingIp.until - now) / 1000)),
      );
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many authentication requests. Try again later.',
      );
    }
    if (accountKey) {
      const existingAcc = this.accountCounters.get(accountKey);
      if (
        existingAcc &&
        existingAcc.until > now &&
        existingAcc.count >= accountLimit
      ) {
        response.setHeader(
          'Retry-After',
          Math.max(1, Math.ceil((existingAcc.until - now) / 1000)),
        );
        throw new ApiError(
          429,
          'RATE_LIMITED',
          'Too many authentication requests. Try again later.',
        );
      }
    }

    this.checkAndIncrement(
      this.ipCounters,
      ipKey,
      ipLimit,
      windowMs,
      now,
      response,
    );
    if (accountKey) {
      this.checkAndIncrement(
        this.accountCounters,
        accountKey,
        accountLimit,
        windowMs,
        now,
        response,
      );
    }
    return true;
  }
}
