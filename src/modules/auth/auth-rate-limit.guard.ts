import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { Request, Response } from 'express';
import { Environment } from '../../config/environment';
import { ApiError } from '../../common/http/api-error';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly counters = new Map<
    string,
    { count: number; until: number }
  >();
  constructor(private readonly config: ConfigService<Environment, true>) {}
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    for (const [key, value] of this.counters)
      if (value.until <= now) this.counters.delete(key);
    const body = request.body as { email?: unknown } | undefined;
    const keys: [string, number][] = [
      [
        `ip:${request.ip}`,
        this.config.get('AUTH_RATE_IP_LIMIT', { infer: true }),
      ],
    ];
    if (typeof body?.email === 'string')
      keys.push([
        `account:${createHash('sha256').update(body.email.trim().toLowerCase()).digest('hex')}`,
        this.config.get('AUTH_RATE_ACCOUNT_LIMIT', { infer: true }),
      ]);
    for (const [key, limit] of keys) {
      const counter = this.counters.get(key);
      if (
        (counter && counter.count >= limit) ||
        (!counter && this.counters.size >= 10000)
      ) {
        response.setHeader(
          'Retry-After',
          Math.max(
            1,
            Math.ceil(((counter?.until ?? now + 60000) - now) / 1000),
          ),
        );
        throw new ApiError(
          429,
          'RATE_LIMITED',
          'Too many authentication requests. Try again later.',
        );
      }
      this.counters.set(key, {
        count: (counter?.count ?? 0) + 1,
        until:
          counter?.until ??
          now +
            this.config.get('AUTH_RATE_WINDOW_SECONDS', { infer: true }) * 1000,
      });
    }
    return true;
  }
}
