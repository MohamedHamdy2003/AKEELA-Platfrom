import { createSign } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment } from '../../config/environment';

export interface FcmCredentials {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface FcmPushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  ok: boolean;
  unregister?: boolean;
  messageId?: string;
  errorCode?: string;
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createServiceAccountAssertion(
  credentials: FcmCredentials,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: credentials.clientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = base64Url(signer.sign(credentials.privateKey));
  return `${unsigned}.${signature}`;
}

export class FcmHttpV1Transport {
  private cachedToken: { token: string; expiresAtMs: number } | null = null;
  private inflightToken: Promise<string> | null = null;

  constructor(
    private readonly credentials: FcmCredentials,
    private readonly httpFetch: typeof fetch = fetch,
  ) {}

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAtMs - now > 300_000) {
      return this.cachedToken.token;
    }
    if (this.inflightToken) return this.inflightToken;

    this.inflightToken = (async () => {
      const assertion = createServiceAccountAssertion(this.credentials);
      const body = new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      });
      const response = await this.httpFetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        throw new Error(
          `FCM OAuth2 token exchange failed (${response.status})`,
        );
      }
      const json = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
      };
      if (!json.access_token) {
        throw new Error('FCM OAuth2 response missing access_token');
      }
      const ttlSeconds = Number(json.expires_in) || 3600;
      this.cachedToken = {
        token: json.access_token,
        expiresAtMs: Date.now() + ttlSeconds * 1000,
      };
      return json.access_token;
    })().finally(() => {
      this.inflightToken = null;
    });

    return this.inflightToken;
  }

  async send(message: FcmPushMessage): Promise<FcmSendResult> {
    let token: string;
    try {
      token = await this.accessToken();
    } catch {
      return { ok: false, errorCode: 'OAUTH_ERROR' };
    }

    const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(
      this.credentials.projectId,
    )}/messages:send`;

    const payload = {
      message: {
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        ...(message.data && Object.keys(message.data).length
          ? { data: message.data }
          : {}),
        android: {
          priority: 'HIGH',
          notification: {
            sound: 'default',
            channel_id: 'akeela_orders',
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      },
    };

    try {
      const response = await this.httpFetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      const body = (await response.json().catch(() => null)) as {
        name?: string;
        error?: {
          status?: string;
          message?: string;
          details?: Array<{ errorCode?: string }>;
        };
      } | null;

      if (response.ok) {
        return { ok: true, messageId: body?.name };
      }

      const fcmCode =
        body?.error?.details?.find((d) => d.errorCode)?.errorCode ??
        body?.error?.status ??
        `HTTP_${response.status}`;

      const unregister =
        fcmCode === 'UNREGISTERED' ||
        fcmCode === 'SENDER_ID_MISMATCH' ||
        (fcmCode === 'INVALID_ARGUMENT' &&
          (body?.error?.message ?? '')
            .toLowerCase()
            .includes('registration token'));

      return { ok: false, unregister, errorCode: fcmCode };
    } catch {
      return { ok: false, errorCode: 'NETWORK_ERROR' };
    }
  }
}

@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);
  private readonly transport: FcmHttpV1Transport | null;

  constructor(private readonly config: ConfigService<Environment, true>) {
    const projectId = this.config.get('FCM_PROJECT_ID', { infer: true });
    const clientEmail = this.config.get('FCM_CLIENT_EMAIL', { infer: true });
    const privateKey = this.config.get('FCM_PRIVATE_KEY', { infer: true });
    if (projectId && clientEmail && privateKey) {
      this.transport = new FcmHttpV1Transport({
        projectId,
        clientEmail,
        privateKey,
      });
    } else {
      this.transport = null;
      if (this.config.get('NODE_ENV', { infer: true }) !== 'test') {
        this.logger.log(
          'FCM credentials are not configured; push delivery is running in no-op mode.',
        );
      }
    }
  }

  get isConfigured(): boolean {
    return this.transport !== null;
  }

  async send(message: FcmPushMessage): Promise<FcmSendResult> {
    if (!this.transport) {
      return { ok: false, errorCode: 'FCM_NOT_CONFIGURED' };
    }
    return this.transport.send(message);
  }
}
