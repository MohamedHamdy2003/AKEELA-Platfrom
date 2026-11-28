import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { formatMoneyCents, moneyCents } from '../../common/money';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CatalogService } from '../catalog/catalog.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { AdminRestaurantAnalyticsQuery, AnalyticsRange } from './orders.dto';
import {
  addDaysIso,
  AnalyticsCache,
  type AnalyticsWindow,
  resolveCairoAnalyticsWindow,
  resolveCustomCairoWindow,
} from './analytics-cache';

function roundRate(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function roundBigIntRate(part: bigint, total: bigint): number {
  if (total <= 0n) return 0;
  return Number((part * 1000n + total / 2n) / total) / 10;
}

function parseOptionalMinutes(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed * 10) / 10)
    : null;
}

@Injectable()
export class RestaurantAnalyticsService {
  private readonly cache = new AnalyticsCache();

  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly restaurants: RestaurantsService,
    private readonly catalog: CatalogService,
  ) {}

  private async assertActiveRestaurant(actor: AuthActor): Promise<string> {
    if (actor.role !== 'Restaurant') {
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    }
    const account = await this.users.byId(actor.userId);
    if (
      !account ||
      account.role !== 'Restaurant' ||
      !account.is_active ||
      !account.email_verified_at
    ) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'An active verified restaurant account is required.',
      );
    }
    const profile = await this.restaurants.profile(actor.userId);
    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Restaurant profile not found.');
    }
    if (profile.activation_status !== 'Active') {
      throw new ApiError(
        403,
        'RESTAURANT_NOT_ACTIVE',
        'Restaurant activation is required to view analytics.',
      );
    }
    return profile.rest_id;
  }

  async overview(actor: AuthActor, range: AnalyticsRange = '30d') {
    const restId = await this.assertActiveRestaurant(actor);
    return this.cache.getOrLoad(`restaurant:${restId}:${range}`, () =>
      this.computeOverview(restId, range),
    );
  }

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
        'An active verified admin account is required.',
      );
    }
  }

  async adminOverview(
    actor: AuthActor,
    restId: string,
    query: AdminRestaurantAnalyticsQuery,
  ) {
    await this.assertActiveAdmin(actor);
    if (!/^[1-9]\d{0,18}$/.test(restId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Restaurant not found.');
    }
    const profile = await this.restaurants.profileById(restId);
    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Restaurant not found.');
    }
    const hasFrom = Boolean(query.date_from);
    const hasTo = Boolean(query.date_to);
    if (hasFrom !== hasTo) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Provide both date_from and date_to for a custom date range.',
      );
    }
    if (query.date_from && query.date_to) {
      if (query.date_from > query.date_to) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Start date must not be after end date.',
        );
      }
      const fromMs = Date.parse(`${query.date_from}T00:00:00Z`);
      const toMs = Date.parse(`${query.date_to}T00:00:00Z`);
      if (
        Number.isNaN(fromMs) ||
        Number.isNaN(toMs) ||
        Math.round((toMs - fromMs) / 86_400_000) + 1 > 366
      ) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Custom date range cannot exceed 366 days.',
        );
      }
      const cacheKey = `admin-rest:${restId}:custom:${query.date_from}:${query.date_to}`;
      return this.cache.getOrLoad(cacheKey, async () => {
        const customWindow = await resolveCustomCairoWindow(
          this.db,
          query.date_from!,
          query.date_to!,
        );
        return this.computeOverview(restId, 'all', customWindow, 'custom');
      });
    }
    const range: AnalyticsRange = query.range ?? '30d';
    return this.cache.getOrLoad(`admin-rest:${restId}:${range}`, () =>
      this.computeOverview(restId, range),
    );
  }

  private async computeOverview(
    restId: string,
    range: AnalyticsRange,
    overrideWindow?: AnalyticsWindow,
    rangeLabel?: AnalyticsRange | 'custom',
  ) {
    const window =
      overrideWindow ?? (await resolveCairoAnalyticsWindow(this.db, range));
    const until = window.until ?? null;
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
          "COUNT(*) FILTER (WHERE o.status IN ('Accepted', 'Picked_Up', 'Delivered', 'Failed'))::int",
          'accepted_orders',
        )
        .addSelect(
          "COALESCE(SUM(o.total_price - o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'food_revenue',
        )
        .addSelect(
          "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'delivery_fees_total',
        )
        .addSelect(
          "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'gross_gmv',
        )
        .addSelect(
          "COALESCE(ROUND(AVG(o.total_price - o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 2), 0)::numeric(14,2)",
          'avg_order_value',
        )
        .addSelect(
          "ROUND(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0) FILTER (WHERE o.status = 'Delivered' AND o.updated_at >= o.created_at)::numeric, 1)",
          'avg_fulfillment_minutes',
        )
        .where('o.rest_id = :restId', { restId });
      if (start) qb.andWhere('o.created_at >= :start', { start });
      if (end) qb.andWhere('o.created_at < :end', { end });
      return qb.getRawOne<{
        total_orders: number;
        delivered_orders: number;
        rejected_orders: number;
        cancelled_orders: number;
        accepted_orders: number;
        food_revenue: string;
        delivery_fees_total: string;
        gross_gmv: string;
        avg_order_value: string;
        avg_fulfillment_minutes: string | null;
      }>();
    };

    const addonsRevenueQuery = (start: Date | null, end: Date | null) => {
      const qb = this.db
        .getRepository(OrderItemAddon)
        .createQueryBuilder('oia')
        .innerJoin(OrderItem, 'oi', 'oi.order_item_id = oia.order_item_id')
        .innerJoin(Order, 'o', 'o.order_id = oi.order_id')
        .select(
          'COALESCE(SUM(oia.subtotal), 0)::numeric(14,2)',
          'addons_revenue',
        )
        .where("o.rest_id = :restId AND o.status = 'Delivered'", { restId });
      if (start) qb.andWhere('o.created_at >= :start', { start });
      if (end) qb.andWhere('o.created_at < :end', { end });
      return qb.getRawOne<{ addons_revenue: string }>();
    };

    const loyaltyQuery = async (): Promise<{
      unique_customers: number;
      repeat_customers: number;
    }> => {
      const params: unknown[] = [restId];
      const clauses: string[] = [];
      if (window.since) {
        params.push(window.since);
        clauses.push(`AND o.created_at >= $${params.length}`);
      }
      if (until) {
        params.push(until);
        clauses.push(`AND o.created_at < $${params.length}`);
      }
      const [row] = (await this.db.query(
        `SELECT
          COUNT(*)::int AS unique_customers,
          COUNT(*) FILTER (WHERE orders_count >= 2)::int AS repeat_customers
        FROM (
          SELECT o.customer_id, COUNT(*) AS orders_count
          FROM orders o
          WHERE o.rest_id = $1 AND o.status = 'Delivered' ${clauses.join(' ')}
          GROUP BY o.customer_id
        ) sub`,
        params,
      )) as [{ unique_customers: number; repeat_customers: number }];
      return {
        unique_customers: Number(row?.unique_customers ?? 0),
        repeat_customers: Number(row?.repeat_customers ?? 0),
      };
    };

    const statusQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('o.rest_id = :restId', { restId })
      .groupBy('o.status');
    if (window.since) {
      statusQb.andWhere('o.created_at >= :since', { since: window.since });
    }
    if (until) {
      statusQb.andWhere('o.created_at < :until', { until });
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
        "COALESCE(SUM(o.total_price - o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'food_revenue',
      )
      .addSelect(
        "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'delivery_fees',
      )
      .addSelect(
        "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'gross_gmv',
      )
      .where('o.rest_id = :restId', { restId })
      .groupBy(
        "to_char((o.created_at AT TIME ZONE 'Africa/Cairo')::date, 'YYYY-MM-DD')",
      );
    if (window.since) {
      dailyQb
        .andWhere('o.created_at >= :since', { since: window.since })
        .orderBy('date', 'ASC');
    } else {
      dailyQb.orderBy('date', 'DESC').limit(90);
    }
    if (until) {
      dailyQb.andWhere('o.created_at < :until', { until });
    }

    const hoursQb = ordersRepo
      .createQueryBuilder('o')
      .select(
        "EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Africa/Cairo'))::int",
        'hour',
      )
      .addSelect('COUNT(*)::int', 'orders')
      .where('o.rest_id = :restId', { restId })
      .groupBy(
        "EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Africa/Cairo'))::int",
      );
    if (window.since) {
      hoursQb.andWhere('o.created_at >= :since', { since: window.since });
    }
    if (until) {
      hoursQb.andWhere('o.created_at < :until', { until });
    }

    const itemsQb = this.db
      .getRepository(OrderItem)
      .createQueryBuilder('oi')
      .innerJoin(Order, 'o', 'o.order_id = oi.order_id')
      .select('oi.prod_id', 'prod_id')
      .addSelect('oi.offer_id', 'offer_id')
      .addSelect('oi.item_name', 'item_name')
      .addSelect('COALESCE(SUM(oi.quantity), 0)::int', 'units_sold')
      .addSelect('COALESCE(SUM(oi.subtotal), 0)::numeric(14,2)', 'revenue')
      .where("o.rest_id = :restId AND o.status = 'Delivered'", { restId })
      .groupBy('oi.prod_id')
      .addGroupBy('oi.offer_id')
      .addGroupBy('oi.item_name');
    if (window.since) {
      itemsQb.andWhere('o.created_at >= :since', { since: window.since });
    }
    if (until) {
      itemsQb.andWhere('o.created_at < :until', { until });
    }

    const topAddonsQb = this.db
      .getRepository(OrderItemAddon)
      .createQueryBuilder('oia')
      .innerJoin(OrderItem, 'oi', 'oi.order_item_id = oia.order_item_id')
      .innerJoin(Order, 'o', 'o.order_id = oi.order_id')
      .select('oia.addon_name', 'addon_name')
      .addSelect('COALESCE(SUM(oia.quantity), 0)::int', 'units_sold')
      .addSelect('COALESCE(SUM(oia.subtotal), 0)::numeric(14,2)', 'revenue')
      .where("o.rest_id = :restId AND o.status = 'Delivered'", { restId })
      .groupBy('oia.addon_name')
      .orderBy('SUM(oia.subtotal)', 'DESC')
      .addOrderBy('SUM(oia.quantity)', 'DESC')
      .limit(6);
    if (window.since) {
      topAddonsQb.andWhere('o.created_at >= :since', { since: window.since });
    }
    if (until) {
      topAddonsQb.andWhere('o.created_at < :until', { until });
    }

    const stalePendingCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const liveAlertsQb = ordersRepo
      .createQueryBuilder('o')
      .select(
        "COUNT(*) FILTER (WHERE o.status = 'Pending')::int",
        'pending_orders',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Pending' AND o.created_at <= :stalePendingCutoff)::int",
        'stale_pending_orders',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status IN ('Accepted', 'Picked_Up'))::int",
        'active_in_progress',
      )
      .where(
        "o.rest_id = :restId AND o.status IN ('Pending', 'Accepted', 'Picked_Up')",
        { restId, stalePendingCutoff },
      );

    // Execute in small bounded batches (<= 4 concurrent queries) to avoid exhausting the pool.
    const [currentRow, prevRow, addonsRevRow, prevAddonsRevRow] =
      await Promise.all([
        kpiQuery(window.since, until),
        window.since && window.prevSince
          ? kpiQuery(window.prevSince, window.since)
          : Promise.resolve(null),
        addonsRevenueQuery(window.since, until),
        window.since && window.prevSince
          ? addonsRevenueQuery(window.prevSince, window.since)
          : Promise.resolve(null),
      ]);

    const [loyalty, statusRows, rawDailyRows, hourRows] = await Promise.all([
      loyaltyQuery(),
      statusQb.getRawMany<{ status: OrderStatus; count: number }>(),
      dailyQb.getRawMany<{
        date: string;
        orders: number;
        delivered: number;
        food_revenue: string;
        delivery_fees: string;
        gross_gmv: string;
      }>(),
      hoursQb.getRawMany<{ hour: number; orders: number }>(),
    ]);

    const [itemRows, addonRows, liveAlertRow, menuSummary] = await Promise.all([
      itemsQb.getRawMany<{
        prod_id: string | null;
        offer_id: string | null;
        item_name: string;
        units_sold: number;
        revenue: string;
      }>(),
      topAddonsQb.getRawMany<{
        addon_name: string;
        units_sold: number;
        revenue: string;
      }>(),
      liveAlertsQb.getRawOne<{
        pending_orders: number;
        stale_pending_orders: number;
        active_in_progress: number;
      }>(),
      this.catalog.restaurantMenuSummary(restId),
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
      dailyRows.map((row) => [
        row.date,
        {
          date: row.date,
          orders: Number(row.orders),
          delivered: Number(row.delivered),
          food_revenue: row.food_revenue,
          delivery_fees: row.delivery_fees,
          gross_gmv: row.gross_gmv,
        },
      ]),
    );
    const daily_series: Array<{
      date: string;
      orders: number;
      delivered: number;
      food_revenue: string;
      delivery_fees: string;
      gross_gmv: string;
    }> = [];
    if (window.startIso && window.days && window.days <= 366) {
      for (let i = 0; i < window.days; i += 1) {
        const date = addDaysIso(window.startIso, i);
        daily_series.push(
          dailyMap.get(date) ?? {
            date,
            orders: 0,
            delivered: 0,
            food_revenue: '0.00',
            delivery_fees: '0.00',
            gross_gmv: '0.00',
          },
        );
      }
    } else {
      for (const row of dailyRows) {
        daily_series.push({
          date: row.date,
          orders: Number(row.orders),
          delivered: Number(row.delivered),
          food_revenue: row.food_revenue,
          delivery_fees: row.delivery_fees,
          gross_gmv: row.gross_gmv,
        });
      }
    }

    const hourMap = new Map(
      hourRows.map((row) => [Number(row.hour), Number(row.orders)]),
    );
    const peak_hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      orders: hourMap.get(hour) ?? 0,
    }));

    const unitsByProdId = new Map<string, number>();
    const catByProdId = new Map(
      menuSummary.products.map((p) => [p.prod_id, p.cat_title]),
    );
    const catAgg = new Map<string, { units: number; revenueCents: bigint }>();
    let totalItemsRevenueCents = 0n;

    const aggregatedItems = new Map<
      string,
      {
        item_name: string;
        item_type: 'product' | 'offer';
        units_sold: number;
        revenueCents: bigint;
      }
    >();

    for (const row of itemRows) {
      const units = Number(row.units_sold);
      const revCents = moneyCents(row.revenue);
      totalItemsRevenueCents += revCents;
      if (row.prod_id) {
        unitsByProdId.set(
          row.prod_id,
          (unitsByProdId.get(row.prod_id) ?? 0) + units,
        );
      }

      const itemType: 'product' | 'offer' = row.offer_id ? 'offer' : 'product';
      const key = `${itemType}:${row.item_name}`;
      const existing = aggregatedItems.get(key);
      if (existing) {
        existing.units_sold += units;
        existing.revenueCents += revCents;
      } else {
        aggregatedItems.set(key, {
          item_name: row.item_name,
          item_type: itemType,
          units_sold: units,
          revenueCents: revCents,
        });
      }

      const catTitle = row.offer_id
        ? 'العروض'
        : (catByProdId.get(row.prod_id ?? '') ?? 'أصناف أخرى');
      const catEntry = catAgg.get(catTitle);
      if (catEntry) {
        catEntry.units += units;
        catEntry.revenueCents += revCents;
      } else {
        catAgg.set(catTitle, { units, revenueCents: revCents });
      }
    }

    const compareBigIntDesc = (a: bigint, b: bigint) =>
      a > b ? -1 : a < b ? 1 : 0;

    const top_items = [...aggregatedItems.values()]
      .sort(
        (a, b) =>
          compareBigIntDesc(a.revenueCents, b.revenueCents) ||
          b.units_sold - a.units_sold,
      )
      .slice(0, 8)
      .map((item) => ({
        item_name: item.item_name,
        item_type: item.item_type,
        units_sold: item.units_sold,
        revenue: formatMoneyCents(item.revenueCents),
        share_pct: roundBigIntRate(item.revenueCents, totalItemsRevenueCents),
      }));

    const category_breakdown = [...catAgg.entries()]
      .sort((a, b) => compareBigIntDesc(a[1].revenueCents, b[1].revenueCents))
      .slice(0, 8)
      .map(([cat_title, agg]) => ({
        cat_title,
        units_sold: agg.units,
        revenue: formatMoneyCents(agg.revenueCents),
        share_pct: roundBigIntRate(agg.revenueCents, totalItemsRevenueCents),
      }));

    const slow_items = menuSummary.products
      .filter((p) => p.is_active)
      .map((p) => ({
        prod_id: p.prod_id,
        prod_name: p.prod_name,
        cat_title: p.cat_title,
        price: p.price,
        units_sold: unitsByProdId.get(p.prod_id) ?? 0,
      }))
      .sort(
        (a, b) =>
          a.units_sold - b.units_sold ||
          compareBigIntDesc(moneyCents(a.price), moneyCents(b.price)),
      )
      .slice(0, 5);

    const uniqueCustomers = loyalty.unique_customers;
    const repeatCustomers = loyalty.repeat_customers;

    const totalOrders = Number(currentRow?.total_orders ?? 0);
    const deliveredOrders = Number(currentRow?.delivered_orders ?? 0);
    const rejectedOrders = Number(currentRow?.rejected_orders ?? 0);
    const cancelledOrders = Number(currentRow?.cancelled_orders ?? 0);
    const acceptedOrders = Number(currentRow?.accepted_orders ?? 0);
    const decidedOrders = acceptedOrders + rejectedOrders;

    return {
      range: rangeLabel ?? range,
      ...(window.endIso
        ? { date_from: window.startIso, date_to: window.endIso }
        : {}),
      generated_at: new Date(),
      kpis: {
        food_revenue: currentRow?.food_revenue ?? '0.00',
        delivery_fees_total: currentRow?.delivery_fees_total ?? '0.00',
        gross_gmv: currentRow?.gross_gmv ?? '0.00',
        addons_revenue: addonsRevRow?.addons_revenue ?? '0.00',
        avg_order_value: currentRow?.avg_order_value ?? '0.00',
        total_orders: totalOrders,
        delivered_orders: deliveredOrders,
        rejected_orders: rejectedOrders,
        cancelled_orders: cancelledOrders,
        acceptance_rate: roundRate(acceptedOrders, decidedOrders),
        completion_rate: roundRate(deliveredOrders, totalOrders),
        rejection_rate: roundRate(rejectedOrders, totalOrders),
        cancellation_rate: roundRate(cancelledOrders, totalOrders),
        unique_customers: uniqueCustomers,
        repeat_customers: repeatCustomers,
        repeat_customer_rate: roundRate(repeatCustomers, uniqueCustomers),
        avg_fulfillment_minutes: parseOptionalMinutes(
          currentRow?.avg_fulfillment_minutes,
        ),
      },
      previous_kpis: prevRow
        ? {
            food_revenue: prevRow.food_revenue ?? '0.00',
            addons_revenue: prevAddonsRevRow?.addons_revenue ?? '0.00',
            avg_order_value: prevRow.avg_order_value ?? '0.00',
            total_orders: Number(prevRow.total_orders ?? 0),
            delivered_orders: Number(prevRow.delivered_orders ?? 0),
            avg_fulfillment_minutes: parseOptionalMinutes(
              prevRow.avg_fulfillment_minutes,
            ),
          }
        : null,
      live_alerts: {
        pending_orders: Number(liveAlertRow?.pending_orders ?? 0),
        stale_pending_orders: Number(liveAlertRow?.stale_pending_orders ?? 0),
        active_in_progress: Number(liveAlertRow?.active_in_progress ?? 0),
        inactive_products: menuSummary.inactive_products,
        expiring_offers: menuSummary.expiring_offers,
      },
      status_breakdown,
      daily_series,
      peak_hours,
      menu_totals: {
        active_categories: menuSummary.active_categories,
        active_products: menuSummary.active_products,
        inactive_products: menuSummary.inactive_products,
        active_addons: menuSummary.active_addons,
        active_offers: menuSummary.active_offers,
      },
      top_items,
      slow_items,
      top_addons: addonRows.map((row) => ({
        addon_name: row.addon_name,
        units_sold: Number(row.units_sold),
        revenue: row.revenue,
      })),
      category_breakdown,
    };
  }
}
