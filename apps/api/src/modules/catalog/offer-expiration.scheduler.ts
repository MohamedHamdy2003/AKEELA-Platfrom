import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { msUntilNextCairoMidnight } from '../../common/time';
import { CatalogService } from './catalog.service';

@Injectable()
export class OfferExpirationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OfferExpirationScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly catalog: CatalogService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    void this.runSweep();
    this.scheduleNextMidnightSweep();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextMidnightSweep(): void {
    if (this.stopped) return;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const delayMs = msUntilNextCairoMidnight();
    this.timer = setTimeout(() => {
      void this.runSweep().finally(() => {
        this.scheduleNextMidnightSweep();
      });
    }, delayMs);
    this.timer.unref?.();
  }

  async runSweep(): Promise<number> {
    try {
      const count = await this.catalog.deactivateExpiredOffers();
      if (count > 0) {
        this.logger.log(
          `Auto-deactivated ${count} expired offer(s) at end of Cairo day.`,
        );
      }
      return count;
    } catch (error) {
      this.logger.warn(
        `Offer expiration sweep failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }
}
