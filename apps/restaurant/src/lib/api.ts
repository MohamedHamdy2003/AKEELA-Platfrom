import { browserSessionStore } from '@akeela/portal/session-store';
import type { SessionStore } from '@akeela/portal/session-store';
import type { Envelope, Tokens, User } from './models.ts';

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string[]>;
  retryAfter: number;
  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string[]> = {},
    retryAfter = 0,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
  }
}
const messages: Record<string, string> = {
  UNAUTHENTICATED: 'انتهت الجلسة. سجّل الدخول مجددًا.',
  FORBIDDEN: 'لا يملك حسابك صلاحية تنفيذ هذا الإجراء.',
  EMAIL_NOT_VERIFIED: 'أكّد بريدك الإلكتروني قبل تسجيل الدخول.',
  RESTAURANT_NOT_ACTIVE: 'إدارة المطعم غير متاحة حتى تفعيله من الإدارة.',
  NOT_FOUND: 'العنصر غير موجود أو لم يعد متاحًا.',
  CONFLICT:
    'تعذّر الحفظ بسبب بيانات مكررة أو تغيّر الحالة. راجع البيانات وحدّث الصفحة.',
  ORDER_CONFLICT: 'تغيّر الطلب أثناء التنفيذ. تم طلب أحدث حالة.',
  DELIVERY_COMPANY_UNAVAILABLE:
    'تعذّر قبول الطلب لعدم توفر شركة التوصيل. ما زال الطلب بانتظار القبول.',
  VALIDATION_ERROR: 'راجع الحقول الموضحة ثم حاول مجددًا.',
  RATE_LIMITED: 'محاولات كثيرة. انتظر قليلًا قبل المحاولة مجددًا.',
  OTP_INVALID_OR_EXPIRED: 'الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا.',
  NETWORK: 'تعذّر الاتصال بالخدمة. تحقق من الاتصال ثم أعد المحاولة.',
};
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return messages[error.code] ?? error.message;
  return error instanceof Error ? error.message : 'تعذّر إتمام العملية.';
}
export class ApiClient {
  private base: string;
  private transport: typeof fetch;
  private sessionStore: SessionStore | null;
  private tokens: Tokens | null = null;
  private generation = 0;
  private refreshing: Promise<void> | null = null;
  private restoring: Promise<User | null> | null = null;
  onSessionEnd?: () => void;
  onActivationDenied?: () => void;
  constructor(
    base: string,
    transport: typeof fetch = (...args) => fetch(...args),
    sessionStore: SessionStore | null = null,
  ) {
    this.base = base.replace(/\/$/, '');
    this.transport = transport;
    this.sessionStore = sessionStore;
    if (!/^\/(?!\/)/.test(base) && !/^https?:\/\//.test(base)) {
      throw new Error('عنوان API غير صالح.');
    }
  }
  setSession(tokens: Tokens) {
    this.generation++;
    this.tokens = tokens;
    this.sessionStore?.write(tokens);
  }
  clearSession() {
    this.generation++;
    this.tokens = null;
    this.sessionStore?.clear();
    this.onSessionEnd?.();
  }
  restoreSession(): Promise<User | null> {
    if (this.restoring) return this.restoring;
    if (!this.tokens) {
      const saved = this.sessionStore?.read();
      if (!saved) return Promise.resolve(null);
      this.setSession(saved);
    }
    const generation = this.generation;
    this.restoring = (async () => {
      try {
        const result = await this.request<User>('/me');
        if (generation !== this.generation) return null;
        if (result.data.role !== 'Restaurant') {
          this.clearSession();
          return null;
        }
        return result.data;
      } catch (error) {
        if (
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        ) {
          if (generation === this.generation) this.clearSession();
          return null;
        }
        throw error;
      }
    })().finally(() => {
      this.restoring = null;
    });
    return this.restoring;
  }
  async login(email: string, password: string): Promise<User> {
    const result = await this.request<{ user: User; tokens: Tokens }>(
      '/auth/login',
      { method: 'POST', body: { email, password }, public: true },
    );
    if (result.data.user.role !== 'Restaurant') {
      await this.transport(this.base + '/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${result.data.tokens.access_token}` },
      }).catch(() => undefined);
      throw new ApiError(
        403,
        'WRONG_ROLE',
        'هذه المساحة مخصصة لحسابات المطاعم.',
      );
    }
    this.setSession(result.data.tokens);
    return result.data.user;
  }
  async tokenForRealtime(): Promise<string | null> {
    if (!this.tokens) return null;
    await this.request('/me');
    return this.tokens?.access_token ?? null;
  }
  private async refresh() {
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    const refreshToken = this.tokens?.refresh_token;
    this.refreshing = (async () => {
      try {
        if (!refreshToken)
          throw new ApiError(401, 'UNAUTHENTICATED', 'انتهت الجلسة.');
        const result = await this.request<Tokens>('/auth/refresh', {
          method: 'POST',
          body: { refresh_token: refreshToken },
          public: true,
        });
        if (generation !== this.generation)
          throw new ApiError(401, 'UNAUTHENTICATED', 'انتهت الجلسة.');
        this.tokens = result.data;
        this.sessionStore?.write(result.data);
      } catch (error) {
        if (
          generation === this.generation &&
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
        )
          this.clearSession();
        throw error;
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      public?: boolean;
      signal?: AbortSignal;
    } = {},
    retry = true,
  ): Promise<Envelope<T>> {
    const requestGeneration = this.generation;
    const access = this.tokens?.access_token;
    const headers: Record<string, string> = {};
    const multipart = options.body instanceof FormData;
    if (options.body !== undefined && !multipart)
      headers['Content-Type'] = 'application/json';
    if (!options.public && access) headers.Authorization = `Bearer ${access}`;
    let response: Response;
    try {
      response = await this.transport(this.base + path, {
        method: options.method ?? 'GET',
        headers,
        body:
          options.body === undefined
            ? undefined
            : multipart
              ? (options.body as FormData)
              : JSON.stringify(options.body),
        signal: options.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(0, 'NETWORK', messages.NETWORK);
    }
    if (
      response.status === 401 &&
      !options.public &&
      retry &&
      this.tokens &&
      requestGeneration === this.generation
    ) {
      if (this.tokens.access_token === access) await this.refresh();
      if (requestGeneration !== this.generation)
        throw new ApiError(401, 'UNAUTHENTICATED', 'انتهت الجلسة.');
      return this.request<T>(path, options, false);
    }
    const data = (await response
      .json()
      .catch(() => null)) as Envelope<T> | null;
    if (!response.ok || !data?.success) {
      const code =
        data?.error?.code ??
        (response.status === 401 ? 'UNAUTHENTICATED' : 'HTTP_ERROR');
      if (code === 'RESTAURANT_NOT_ACTIVE') this.onActivationDenied?.();
      if (
        response.status === 401 &&
        !options.public &&
        requestGeneration === this.generation
      )
        this.clearSession();
      throw new ApiError(
        response.status,
        code,
        data?.message ?? 'تعذّر إتمام الطلب. حاول مجددًا.',
        data?.error?.fields,
        Number(response.headers.get('Retry-After')) || 0,
      );
    }
    return data;
  }
}
const base = import.meta.env?.VITE_API_BASE_URL || '/api/v1';
export const api = new ApiClient(
  base,
  undefined,
  browserSessionStore(base, 'Restaurant'),
);
export function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return '?' + params.toString();
}
