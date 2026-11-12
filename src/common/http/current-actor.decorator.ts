import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export interface AuthActor {
  userId: string;
  sessionId: string;
}
export type AuthenticatedRequest = Request & { actor: AuthActor };
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthActor =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().actor,
);
