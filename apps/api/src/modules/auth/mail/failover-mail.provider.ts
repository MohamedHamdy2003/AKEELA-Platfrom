import { Logger } from '@nestjs/common';
import type { MailProvider, OutgoingMail } from './mail-provider.interface';

const DEFAULT_QUOTA_COOLDOWN_MS = 60 * 60 * 1000;
const DEFAULT_TRANSIENT_COOLDOWN_MS = 15 * 60 * 1000;

export type FailureKind = 'quota' | 'recipient' | 'transient';

export interface FailoverOptions {
  quotaCooldownMs?: number;
  transientCooldownMs?: number;
  now?: () => number;
}

export function classifyMailError(error: unknown): FailureKind {
  const err = error as {
    responseCode?: number;
    code?: string;
    message?: string;
    response?: string;
  };
  const code = err?.responseCode;
  const text =
    `${err?.code ?? ''} ${err?.message ?? ''} ${err?.response ?? ''}`.toLowerCase();

  if (
    code === 429 ||
    code === 452 ||
    /quota|daily|limit|rate|credit|exceeded|too many|monthly/.test(text)
  ) {
    return 'quota';
  }

  if (
    code !== undefined &&
    code >= 500 &&
    code < 600 &&
    /user unknown|no such user|mailbox unavailable|recipient|invalid address|5\.1\.1/.test(
      text,
    )
  ) {
    return 'recipient';
  }

  return 'transient';
}

export class FailoverMailProvider implements MailProvider {
  readonly name: string;
  private readonly logger = new Logger(FailoverMailProvider.name);
  private readonly cooldownUntil = new Map<string, number>();
  private readonly quotaCooldownMs: number;
  private readonly transientCooldownMs: number;
  private readonly now: () => number;

  constructor(
    private readonly providers: MailProvider[],
    options: FailoverOptions = {},
  ) {
    if (!providers.length) {
      throw new Error('At least one mail provider is required.');
    }
    this.name = providers.map((p) => p.name).join('->');
    this.quotaCooldownMs = options.quotaCooldownMs ?? DEFAULT_QUOTA_COOLDOWN_MS;
    this.transientCooldownMs =
      options.transientCooldownMs ?? DEFAULT_TRANSIENT_COOLDOWN_MS;
    this.now = options.now ?? (() => Date.now());
  }

  private orderedCandidates(): MailProvider[] {
    const now = this.now();
    const active: MailProvider[] = [];
    const cooling: Array<{ provider: MailProvider; until: number }> = [];

    for (const provider of this.providers) {
      const until = this.cooldownUntil.get(provider.name) ?? 0;
      if (until <= now) {
        this.cooldownUntil.delete(provider.name);
        active.push(provider);
      } else {
        cooling.push({ provider, until });
      }
    }

    if (active.length > 0) return active;
    // Safety net: if every provider is cooling down, still attempt delivery
    // starting with the one whose cooldown expires earliest.
    cooling.sort((a, b) => a.until - b.until);
    return cooling.map((item) => item.provider);
  }

  async send(message: OutgoingMail): Promise<void> {
    const candidates = this.orderedCandidates();
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i += 1) {
      const provider = candidates[i]!;
      try {
        await provider.send(message);
        this.cooldownUntil.delete(provider.name);
        if (provider !== this.providers[0]) {
          this.logger.log(
            `OTP email delivered via fallback provider "${provider.name}".`,
          );
        }
        return;
      } catch (error) {
        lastError = error;
        const kind = classifyMailError(error);
        if (kind === 'recipient') {
          throw error;
        }
        const cooldownMs =
          kind === 'quota' ? this.quotaCooldownMs : this.transientCooldownMs;
        this.cooldownUntil.set(provider.name, this.now() + cooldownMs);

        const hasNext = i < candidates.length - 1;
        this.logger.warn(
          hasNext
            ? `Mail provider "${provider.name}" failed (${kind}); failing over to next provider.`
            : `Mail provider "${provider.name}" failed (${kind}); no fallback provider left.`,
        );
      }
    }

    throw lastError ?? new Error('All mail providers failed.');
  }

  async verify(): Promise<void> {
    for (const provider of this.providers) {
      await provider.verify();
    }
  }

  close(): void {
    for (const provider of this.providers) {
      provider.close();
    }
  }
}
