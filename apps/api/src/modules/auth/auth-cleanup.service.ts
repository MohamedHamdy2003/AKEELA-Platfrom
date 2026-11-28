import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Environment } from '../../config/environment';
import { AuthSession } from './entities/auth-session.entity';
import { AuthChallenge } from './entities/auth-challenge.entity';

const FIRST_RUN_DELAY_MS = 5 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SESSION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CHALLENGE_RETENTION_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthCleanupService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DataSource,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setTimeout(() => {
      void this.cleanupExpired();
      this.timer = setInterval(() => {
        void this.cleanupExpired();
      }, RUN_INTERVAL_MS);
      this.timer.unref?.();
    }, FIRST_RUN_DELAY_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
    }
  }

  async cleanupExpired(): Promise<{ sessions: number; challenges: number }> {
    try {
      const sessionCutoff = new Date(Date.now() - SESSION_RETENTION_MS);
      const challengeCutoff = new Date(Date.now() - CHALLENGE_RETENTION_MS);
      // Run the two auth_sessions deletes sequentially so overlapping rows
      // (both expired and revoked) cannot trigger PostgreSQL 40P01 deadlocks.
      const expiredSessionsResult = await this.db
        .createQueryBuilder()
        .delete()
        .from(AuthSession)
        .where('expires_at < :cutoff', { cutoff: sessionCutoff })
        .execute();
      const revokedSessionsResult = await this.db
        .createQueryBuilder()
        .delete()
        .from(AuthSession)
        .where('revoked_at IS NOT NULL AND revoked_at < :cutoff', {
          cutoff: sessionCutoff,
        })
        .execute();
      const challengesResult = await this.db
        .createQueryBuilder()
        .delete()
        .from(AuthChallenge)
        .where('expires_at < :cutoff', { cutoff: challengeCutoff })
        .execute();
      const sessions =
        (expiredSessionsResult.affected ?? 0) +
        (revokedSessionsResult.affected ?? 0);
      const challenges = challengesResult.affected ?? 0;
      if (sessions > 0 || challenges > 0) {
        this.logger.log(
          `Cleaned ${sessions} expired/revoked session(s) and ${challenges} expired challenge(s).`,
        );
      }
      return { sessions, challenges };
    } catch (error) {
      this.logger.error(`Auth cleanup failed: ${String(error)}`);
      return { sessions: 0, challenges: 0 };
    }
  }
}
