import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE = 'akeela:public-route';
export const PublicRoute = (isPublic = true) =>
  SetMetadata(PUBLIC_ROUTE, isPublic);
