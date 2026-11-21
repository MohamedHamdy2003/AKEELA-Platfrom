import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Environment } from '../../config/environment';
import { Order } from './entities/order.entity';
import { OrderEventsGateway } from './order-events.gateway';

/** Auto-deliver orders that have been in Picked_Up status for ≥ 90 minutes. */
@Injectable()
export class OrdersAutoDeliverService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersAutoDeliverService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DataSource,
    private readonly events: OrderEventsGateway,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    // Check every 5 minutes; first run after 1 minute to let the app warm up.
    this.timer = setTimeout(() => {
      void this.autoDeliver();
      this.timer = setInterval(
        () => {
          void this.autoDeliver();
        },
        5 * 60 * 1000,
      );
      this.timer.unref?.();
    }, 60 * 1000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      clearInterval(this.timer);
    }
  }

  async autoDeliver(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 90 * 60 * 1000);
      const repo = this.db.getRepository(Order);
      const stale = await repo
        .createQueryBuilder('o')
        .select(['o.order_id'])
        .where("o.status = 'Picked_Up'")
        .andWhere('o.updated_at <= :cutoff', { cutoff })
        .skip(0)
        .take(100)
        .getMany()
        .catch(() => [] as Order[]);

      if (!stale.length) return;

      this.logger.log(
        `Auto-delivering ${stale.length} stale Picked_Up order(s).`,
      );

      for (const order of stale) {
        try {
          await this.db.transaction('SERIALIZABLE', async (m) => {
            const locked = await m
              .getRepository(Order)
              .createQueryBuilder('o')
              .where('o.order_id = :id', { id: order.order_id })
              .andWhere("o.status = 'Picked_Up'")
              .andWhere('o.updated_at <= :cutoff', { cutoff })
              .setLock('pessimistic_write')
              .getOne();
            if (!locked) return; // already transitioned by another operation
            locked.status = 'Delivered';
            await m.getRepository(Order).save(locked);
          });
          // Reload fresh order to broadcast correct state
          const fresh = await repo.findOneBy({ order_id: order.order_id });
          if (fresh) await this.events.notify('order.updated', fresh);
        } catch (err) {
          this.logger.warn(
            `Failed to auto-deliver order ${order.order_id}: ${String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Auto-deliver scan failed: ${String(err)}`);
    }
  }
}
