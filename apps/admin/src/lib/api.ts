import { browserSessionStore } from '@akeela/portal/session-store';
import { ApiClient } from '@akeela/portal/api';
export const base = import.meta.env.VITE_API_BASE_URL || '/api/v1';
export const api = new ApiClient(
  base,
  'Admin',
  undefined,
  browserSessionStore(base, 'Admin'),
);
