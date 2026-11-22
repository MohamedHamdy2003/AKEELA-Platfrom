import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DeliveryService } from '../delivery/delivery.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { AnalyticsRange } from './orders.dto';
import {
  addDaysIso,
  AnalyticsCache,
  resolveCairoAnalyticsWindow,
} from './analytics-cache';

function roundRate(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

@Injectable()
export class AdminAnalyticsService {
  private readonly cache = new AnalyticsCache();

  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
  ) {}

  private async assertActiveAdmin(actor: AuthActor): Promise<void> {
    if (actor.role !== 'Admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
    }
    const account = await this.users.byId(actor.userId);
    if (
      !account ||
      account.role !== 'Admin' ||
      !account.is_active ||
      !account.email_verified_at
    ) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'An active verified account is required.',
      );
    }
  }

  async overview(actor: AuthActor, range: AnalyticsRange = '30d') {
    await this.assertActiveAdmin(actor);
    return this.cache.getOrLoad(`admin:${range}`, () =>
      this.computeOverview(range),
    );
  }

  private async computeOverview(range: AnalyticsRange) {
    const window = await resolveCairoAnalyticsWindow(this.db, range);
    const ordersRepo = this.db.getRepository(Order);

    const kpiQuery = (start: Date | null, end: Date | null) => {
      const qb = ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(*)::int', 'total_orders')
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
          'delivered_orders',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Rejected')::int",
          'rejected_orders',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Cancelled')::int",
          'cancelled_orders',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Failed')::int",
          'failed_orders',
        )
        .addSelect(
          "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'delivered_gmv',
        )
        .addSelect(
          "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'delivery_fees_total',
        )
        .addSelect(
          "COALESCE(ROUND(AVG(o.total_price) FILTER (WHERE o.status = 'Delivered'), 2), 0)::numeric(14,2)",
          'avg_order_value',
        );
      if (start) qb.andWhere('o.created_at >= :start', { start });
      if (end) qb.andWhere('o.created_at < :end', { end });
      return qb.getRawOne<{
        total_orders: number;
        delivered_orders: number;
        rejected_orders: number;
        cancelled_orders: number;
        failed_orders: number;
        delivered_gmv: string;
        delivery_fees_total: string;
        avg_order_value: string;
      }>();
    };

    const statusQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('o.status');
    if (window.since) {
      statusQb.where('o.created_at >= :since', { since: window.since });
    }

    const dailyQb = ordersRepo
      .createQueryBuilder('o')
      .select(
        "to_char((o.created_at AT TIME ZONE 'Africa/Cairo')::date, 'YYYY-MM-DD')",
        'date',
      )
      .addSelect('COUNT(*)::int', 'orders')
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
        'delivered',
      )
      .addSelect(
        "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'gmv',
      )
      .groupBy(
        "to_char((o.created_at AT TIME ZONE 'Africa/Cairo')::date, 'YYYY-MM-DD')",
      );
    if (window.since) {
      dailyQb
        .where('o.created_at >= :since', { since: window.since })
        .orderBy('date', 'ASC');
    } else {
      dailyQb.orderBy('date', 'DESC').limit(90);
    }

    const hoursQb = ordersRepo
      .createQueryBuilder('o')
      .select(
        "EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Africa/Cairo'))::int",
        'hour',
      )
      .addSelect('COUNT(*)::int', 'orders')
      .groupBy(
        "EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Africa/Cairo'))::int",
      );
    if (window.since) {
      hoursQb.where('o.created_at >= :since', { since: window.since });
    }

    const restBaseSelect = () => {
      const qb = ordersRepo
        .createQueryBuilder('o')
        .select('o.rest_id', 'rest_id')
        .addSelect('COUNT(*)::int', 'total_orders')
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
          'delivered_orders',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Rejected')::int",
          'rejected_orders',
        )
        .addSelect(
          "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'gmv',
        )
        .groupBy('o.rest_id');
      if (window.since) {
        qb.where('o.created_at >= :since', { since: window.since });
      }
      return qb;
    };

    const topRestaurantsQb = restBaseSelect()
      .orderBy(
        "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)",
        'DESC',
      )
      .addOrderBy("COUNT(*) FILTER (WHERE o.status = 'Delivered')", 'DESC')
      .addOrderBy('COUNT(*)', 'DESC')
      .limit(5);

    const attentionRestaurantsQb = restBaseSelect()
      .having("COUNT(*) FILTER (WHERE o.status = 'Rejected') > 0")
      .orderBy(
        "(COUNT(*) FILTER (WHERE o.status = 'Rejected')::float / NULLIF(COUNT(*), 0))",
        'DESC',
      )
      .addOrderBy("COUNT(*) FILTER (WHERE o.status = 'Rejected')", 'DESC')
      .limit(5);

    const topItemsQb = this.db
      .getRepository(OrderItem)
      .createQueryBuilder('oi')
      .innerJoin(Order, 'o', 'o.order_id = oi.order_id')
      .select('oi.rest_id', 'rest_id')
      .addSelect('oi.item_name', 'item_name')
      .addSelect('COALESCE(SUM(oi.quantity), 0)::int', 'units_sold')
      .addSelect('COALESCE(SUM(oi.subtotal), 0)::numeric(14,2)', 'revenue')
      .where("o.status = 'Delivered'")
      .groupBy('oi.rest_id')
      .addGroupBy('oi.item_name')
      .orderBy('SUM(oi.subtotal)', 'DESC')
      .addOrderBy('SUM(oi.quantity)', 'DESC')
      .limit(6);
    if (window.since) {
      topItemsQb.andWhere('o.created_at >= :since', { since: window.since });
    }

    const stalePendingCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const staleAcceptedCutoff = new Date(Date.now() - 20 * 60 * 1000);
    const staleAlertsQb = ordersRepo
      .createQueryBuilder('o')
      .select(
        "COUNT(*) FILTER (WHERE o.status = 'Pending' AND o.created_at <= :stalePendingCutoff)::int",
        'stale_pending',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Accepted' AND o.driver_id IS NULL AND o.updated_at <= :staleAcceptedCutoff)::int",
        'stale_accepted',
      )
      .where("o.status IN ('Pending', 'Accepted')", {
        stalePendingCutoff,
        staleAcceptedCutoff,
      });

    // Run in bounded batches of <= 4 concurrent queries so analytics never starve the DB pool.
    const [currentRow, prevRow, statusRows, rawDailyRows] = await Promise.all([
      kpiQuery(window.since, null),
      window.since && window.prevSince
        ? kpiQuery(window.prevSince, window.since)
        : Promise.resolve(null),
      statusQb.getRawMany<{ status: OrderStatus; count: number }>(),
      dailyQb.getRawMany<{
        date: string;
        orders: number;
        delivered: number;
        gmv: string;
      }>(),
    ]);

    const [hourRows, topRestRows, attentionRestRows, itemRows] =
      await Promise.all([
        hoursQb.getRawMany<{ hour: number; orders: number }>(),
        topRestaurantsQb.getRawMany<{
          rest_id: string;
          total_orders: number;
          delivered_orders: number;
          rejected_orders: number;
          gmv: string;
        }>(),
        attentionRestaurantsQb.getRawMany<{
          rest_id: string;
          total_orders: number;
          delivered_orders: number;
          rejected_orders: number;
          gmv: string;
        }>(),
        topItemsQb.getRawMany<{
          rest_id: string;
          item_name: string;
          units_sold: number;
          revenue: string;
        }>(),
      ]);

    const [staleRow, userSummary, restActivation, driverSummary] =
      await Promise.all([
        staleAlertsQb.getRawOne<{
          stale_pending: number;
          stale_accepted: number;
        }>(),
        this.users.analyticsSummary(window.since, window.prevSince),
        this.restaurants.activationSummary(),
        this.delivery.driverCounts(),
      ]);

    const dailyRows = window.since ? rawDailyRows : [...rawDailyRows].reverse();

    const status_breakdown: Record<OrderStatus, number> = {
      Pending: 0,
      Accepted: 0,
      Picked_Up: 0,
      Delivered: 0,
      Rejected: 0,
      Cancelled: 0,
      Failed: 0,
    };
    for (const row of statusRows) {
      if (row.status in status_breakdown) {
        status_breakdown[row.status] = Number(row.count);
      }
    }

    const dailyMap = new Map(
      dailyRows.map((r) => [
        r.date,
        {
          date: r.date,
          orders: Number(r.orders),
          delivered: Number(r.delivered),
          gmv: r.gmv,
        },
      ]),
    );
    const daily_series: Array<{
      date: string;
      orders: number;
      delivered: number;
      gmv: string;
    }> = [];
    if (window.startIso && window.days) {
      for (let i = 0; i < window.days; i += 1) {
        const date = addDaysIso(window.startIso, i);
        daily_series.push(
          dailyMap.get(date) ?? { date, orders: 0, delivered: 0, gmv: '0.00' },
        );
      }
    } else {
      for (const row of dailyRows) {
        daily_series.push({
          date: row.date,
          orders: Number(row.orders),
          delivered: Number(row.delivered),
          gmv: row.gmv,
        });
      }
    }

    const hourMap = new Map(
      hourRows.map((r) => [Number(r.hour), Number(r.orders)]),
    );
    const peak_hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: hourMap.get(hour) ?? 0,
    }));

    const parseRestRow = (row: {
      rest_id: string;
      total_orders: number;
      delivered_orders: number;
      rejected_orders: number;
      gmv: string;
    }) => {
      const total = Number(row.total_orders);
      const delivered = Number(row.delivered_orders);
      const rejected = Number(row.rejected_orders);
      return {
        rest_id: row.rest_id,
        total_orders: total,
        delivered_orders: delivered,
        rejected_orders: rejected,
        rejection_rate: roundRate(rejected, total),
        gmv: row.gmv,
      };
    };

    const topRaw = topRestRows.map(parseRestRow);
    const attentionRaw = attentionRestRows.map(parseRestRow);

    const neededRestIds = [
      ...new Set([
        ...topRaw.map((r) => r.rest_id),
        ...attentionRaw.map((r) => r.rest_id),
        ...itemRows.map((r) => r.rest_id),
      ]),
    ];
    const restTitles = await this.restaurants.titlesByIds(neededRestIds);

    const attachTitle = <T extends { rest_id: string }>(rows: T[]) =>
      rows.map((row) => ({
        ...row,
        rest_title: restTitles.get(row.rest_id) ?? `#${row.rest_id}`,
      }));

    const totalOrders = Number(currentRow?.total_orders ?? 0);
    const deliveredOrders = Number(currentRow?.delivered_orders ?? 0);
    const rejectedOrders = Number(currentRow?.rejected_orders ?? 0);
    const cancelledOrders = Number(currentRow?.cancelled_orders ?? 0);
    const failedOrders = Number(currentRow?.failed_orders ?? 0);

    return {
      range,
      generated_at: new Date(),
      kpis: {
        delivered_gmv: currentRow?.delivered_gmv ?? '0.00',
        delivery_fees_total: currentRow?.delivery_fees_total ?? '0.00',
        avg_order_value: currentRow?.avg_order_value ?? '0.00',
        total_orders: totalOrders,
        delivered_orders: deliveredOrders,
        completion_rate: roundRate(deliveredOrders, totalOrders),
        rejection_rate: roundRate(rejectedOrders, totalOrders),
        cancellation_rate: roundRate(cancelledOrders, totalOrders),
        failure_rate: roundRate(failedOrders, totalOrders),
        new_customers: userSummary.period.new_customers,
        new_restaurants: userSummary.period.new_restaurants,
      },
      previous_kpis: prevRow
        ? {
            delivered_gmv: prevRow.delivered_gmv ?? '0.00',
            delivery_fees_total: prevRow.delivery_fees_total ?? '0.00',
            avg_order_value: prevRow.avg_order_value ?? '0.00',
            total_orders: Number(prevRow.total_orders ?? 0),
            delivered_orders: Number(prevRow.delivered_orders ?? 0),
            new_customers: userSummary.previous?.new_customers ?? 0,
            new_restaurants: userSummary.previous?.new_restaurants ?? 0,
          }
        : null,
      status_breakdown,
      daily_series,
      peak_hours,
      top_restaurants: attachTitle(topRaw),
      attention_restaurants: attachTitle(attentionRaw),
      top_items: attachTitle(
        itemRows.map((row) => ({
          rest_id: row.rest_id,
          item_name: row.item_name,
          units_sold: Number(row.units_sold),
          revenue: row.revenue,
        })),
      ),
      alerts: {
        stale_pending_orders: Number(staleRow?.stale_pending ?? 0),
        stale_accepted_orders: Number(staleRow?.stale_accepted ?? 0),
        pending_restaurants: restActivation.pending,
        unverified_companies: userSummary.totals.unverified_companies,
      },
      platform_totals: {
        total_users: userSummary.totals.total_users,
        customers: userSummary.totals.customers,
        restaurants_total: restActivation.total,
        restaurants_active: restActivation.active,
        restaurants_pending: restActivation.pending,
        restaurants_suspended: restActivation.suspended,
        delivery_companies: userSummary.totals.delivery_companies,
        active_drivers: driverSummary.active,
        inactive_drivers: driverSummary.inactive,
      },
    };
  }
}
