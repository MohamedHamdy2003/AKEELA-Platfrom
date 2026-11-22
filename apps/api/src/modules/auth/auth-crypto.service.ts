import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto';
import { Environment } from '../../config/environment';
import { Semaphore } from '../../common/concurrency';

const scryptConcurrency = new Semaphore(2);

@Injectable()
export class AuthCryptoService {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  private derive(password: string, salt: string): Promise<Buffer> {
    return scryptConcurrency.run(
      () =>
        new Promise((resolve, reject) =>
          scrypt(
            password,
            salt,
            64,
            { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 },
            (error, key) => (error ? reject(error) : resolve(key)),
          ),
        ),
    );
  }
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const hash = await this.derive(password, salt);
    return `scrypt$65536$8$2$${salt}$${hash.toString('hex')}`;
  }
  async verifyPassword(
    password: string,
    encoded: string | null,
  ): Promise<boolean> {
    const parts = encoded?.split('$');
    const valid =
      parts?.length === 6 &&
      parts.slice(0, 4).join('$') === 'scrypt$65536$8$2' &&
      /^[a-f0-9]{32}$/.test(parts[4] ?? '') &&
      /^[a-f0-9]{128}$/.test(parts[5] ?? '');
    // Use the same work factor for unknown accounts to avoid a cheap enumeration path.
    const actual = await this.derive(
      password,
      valid ? parts[4]! : '00000000000000000000000000000000',
    );
    return Boolean(
      valid && timingSafeEqual(actual, Buffer.from(parts![5]!, 'hex')),
    );
  }
  newOtp(): string {
    return randomInt(0, 1000000).toString().padStart(6, '0');
  }
  otpHash(userId: string, purpose: string, code: string): string {
    return createHmac('sha256', this.config.get('OTP_SECRET', { infer: true }))
      .update(`${userId}:${purpose}:${code}`)
      .digest('hex');
  }
  matchesOtp(
    userId: string,
    purpose: string,
    code: string,
    expected: string,
  ): boolean {
    const hash = Buffer.from(this.otpHash(userId, purpose, code), 'hex');
    const saved = Buffer.from(expected, 'hex');
    return hash.length === saved.length && timingSafeEqual(hash, saved);
  }
  newRefresh(): string {
    return randomBytes(32).toString('base64url');
  }
  tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
