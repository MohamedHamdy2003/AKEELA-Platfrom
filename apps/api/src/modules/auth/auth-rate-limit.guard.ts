import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { Environment } from '../../config/environment';
import { ApiError } from '../../common/http/api-error';
import type { AuthActor } from '../../common/http/current-actor.decorator';
import { FixedWindowRateLimiter } from '../../common/http/fixed-window-rate-limiter';

const MAX_TRACKED_KEYS = 10_000;

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly ipLimiter = new FixedWindowRateLimiter(MAX_TRACKED_KEYS);
  private readonly accountLimiter = new FixedWindowRateLimiter(
    MAX_TRACKED_KEYS,
  );

  constructor(private readonly config: ConfigService<Environment, true>) {}

  private throwLimited(response: Response, retryAfterSeconds: number): never {
    response.setHeader('Retry-After', retryAfterSeconds);
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Too many authentication requests. Try again later.',
    );
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
    const ipBlocked = this.ipLimiter.peekBlocked(ipKey, ipLimit, now);
    if (ipBlocked > 0) this.throwLimited(response, ipBlocked);
    if (accountKey) {
      const accountBlocked = this.accountLimiter.peekBlocked(
        accountKey,
        accountLimit,
        now,
      );
      if (accountBlocked > 0) this.throwLimited(response, accountBlocked);
    }

    const ipResult = this.ipLimiter.consume(ipKey, ipLimit, windowMs, now);
    if (!ipResult.allowed) {
      this.throwLimited(response, ipResult.retryAfterSeconds);
    }
    if (accountKey) {
      const accountResult = this.accountLimiter.consume(
        accountKey,
        accountLimit,
        windowMs,
        now,
      );
      if (!accountResult.allowed) {
        this.throwLimited(response, accountResult.retryAfterSeconds);
      }
    }
    return true;
  }
}
