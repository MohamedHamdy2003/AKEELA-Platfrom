import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Environment } from '../../config/environment';
import { ApiError } from './api-error';
import { FixedWindowRateLimiter } from './fixed-window-rate-limiter';

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 300;
const MAX_TRACKED_IPS = 20_000;

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private readonly limiter = new FixedWindowRateLimiter(MAX_TRACKED_IPS);

  constructor(private readonly config: ConfigService<Environment, true>) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? request.url ?? '';
    if (path.startsWith('/api/v1/health/')) return true;

    const response = context.switchToHttp().getResponse<Response>();
    const key = request.ip || 'unknown';
    const result = this.limiter.consume(
      key,
      MAX_REQUESTS_PER_WINDOW,
      WINDOW_MS,
    );
    if (!result.allowed) {
      response.setHeader('Retry-After', result.retryAfterSeconds);
      throw new ApiError(
        429,
        'RATE_LIMITED',
        'Too many requests. Try again shortly.',
      );
    }
    return true;
  }
}
