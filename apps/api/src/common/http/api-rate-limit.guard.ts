import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Environment } from '../../config/environment';
import { ApiError } from './api-error';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 300;
const MAX_TRACKED_IPS = 20_000;

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private readonly counters = new Map<
    string,
    { count: number; until: number }
  >();

  constructor(private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? request.url ?? '';
    if (path.startsWith('/api/v1/health/')) return true;

    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    if (this.counters.size > 1000) {
      for (const [key, value] of this.counters) {
        if (value.until <= now) this.counters.delete(key);
      }
    }

    const key = request.ip || 'unknown';
    const current = this.counters.get(key);
    const active = current && current.until > now ? current : undefined;

    if (active && active.count >= MAX_REQUESTS_PER_WINDOW) {
      response.setHeader(
        'Retry-After',
        Math.max(1, Math.ceil((active.until - now) / 1000)),
      );
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many requests. Try again shortly.',
      );
    }

    if (!active && this.counters.size >= MAX_TRACKED_IPS) {
      for (const [entryKey, value] of this.counters) {
        if (value.until <= now) this.counters.delete(entryKey);
      }
      if (this.counters.size >= MAX_TRACKED_IPS) {
        const oldest = this.counters.keys().next().value;
        if (oldest !== undefined) this.counters.delete(oldest);
      }
    }

    this.counters.delete(key);
    this.counters.set(key, {
      count: (active?.count ?? 0) + 1,
      until: active?.until ?? now + WINDOW_MS,
    });
    return true;
  }
}
