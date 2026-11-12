import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../../common/http/api-error';
import { PUBLIC_ROUTE } from '../../common/http/public-route.decorator';
import { AuthenticatedRequest } from '../../common/http/current-actor.decorator';
import { AuthService } from './auth.service';
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (
      !header ||
      !/^Bearer [A-Za-z0-9_.-]+$/i.test(header) ||
      header.length > 8192
    )
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'A valid access token is required.',
      );
    request.actor = await this.auth.authenticate(header.slice(7));
    return true;
  }
}
