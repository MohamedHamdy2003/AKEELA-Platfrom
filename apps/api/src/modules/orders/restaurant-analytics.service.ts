import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { CatalogService } from '../catalog/catalog.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { AnalyticsRange } from './orders.dto';

function roundRate(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function parseOptionalMinutes(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(0, Math.round(parsed * 10) / 10)
    : null;
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  return dt.toISOString().slice(0, 10);
}

@Injectable()
export class RestaurantAnalyticsService {
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

  private async resolveWindow(range: AnalyticsRange): Promise<{
    todayIso: string;
    startIso: string | null;
    since: Date | null;
    prevSince: Date | null;
    days: number | null;
  }> {
    const [{ today_iso }] = (await this.db.query(
      "SELECT to_char((NOW() AT TIME ZONE 'Africa/Cairo')::date, 'YYYY-MM-DD') AS today_iso",
    )) as [{ today_iso: string }];

    if (range === 'all') {
      return {
        todayIso: today_iso,
        startIso: null,
        since: null,
        prevSince: null,
        days: null,
      };
    }

    const days =
      range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const startIso = addDaysIso(today_iso, -(days - 1));
    const prevStartIso = addDaysIso(startIso, -days);

    const [{ since, prev_since }] = (await this.db.query(
      "SELECT (CAST($1 AS date)::timestamp AT TIME ZONE 'Africa/Cairo') AS since, (CAST($2 AS date)::timestamp AT TIME ZONE 'Africa/Cairo') AS prev_since",
      [startIso, prevStartIso],
    )) as [{ since: Date; prev_since: Date }];

    return {
      todayIso: today_iso,
      startIso,
      since: new Date(since),
      prevSince: new Date(prev_since),
      days,
    };
  }

  async overview(actor: AuthActor, range: AnalyticsRange = '30d') {
    const restId = await this.assertActiveRestaurant(actor);
    const window = await this.resolveWindow(range);
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

    const loyaltyQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.customer_id', 'customer_id')
      .addSelect('COUNT(*)::int', 'orders_count')
      .where("o.rest_id = :restId AND o.status = 'Delivered'", { restId })
      .groupBy('o.customer_id');
    if (window.since) {
      loyaltyQb.andWhere('o.created_at >= :since', { since: window.since });
    }

    const statusQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('o.rest_id = :restId', { restId })
      .groupBy('o.status');
    if (window.since) {
      statusQb.andWhere('o.created_at >= :since', { since: window.since });
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
      .where('o.rest_id = :restId', { restId })
      .groupBy(
        "to_char((o.created_at AT TIME ZONE 'Africa/Cairo')::date, 'YYYY-MM-DD')",
      )
      .orderBy('date', 'ASC');
    if (window.since) {
      dailyQb.andWhere('o.created_at >= :since', { since: window.since });
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
      .where('o.rest_id = :restId', { restId, stalePendingCutoff });

    const [
      currentRow,
      prevRow,
      addonsRevRow,
      prevAddonsRevRow,
      loyaltyRows,
      statusRows,
      dailyRows,
      hourRows,
      itemRows,
      addonRows,
      liveAlertRow,
      menuSummary,
    ] = await Promise.all([
      kpiQuery(window.since, null),
      window.since && window.prevSince
        ? kpiQuery(window.prevSince, window.since)
        : Promise.resolve(null),
      addonsRevenueQuery(window.since, null),
      window.since && window.prevSince
        ? addonsRevenueQuery(window.prevSince, window.since)
        : Promise.resolve(null),
      loyaltyQb.getRawMany<{ customer_id: string; orders_count: number }>(),
      statusQb.getRawMany<{ status: OrderStatus; count: number }>(),
      dailyQb.getRawMany<{
        date: string;
        orders: number;
        delivered: number;
        food_revenue: string;
      }>(),
      hoursQb.getRawMany<{ hour: number; orders: number }>(),
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
        },
      ]),
    );
    const daily_series: Array<{
      date: string;
      orders: number;
      delivered: number;
      food_revenue: string;
    }> = [];
    if (window.startIso && window.days) {
      for (let i = 0; i < window.days; i += 1) {
        const date = addDaysIso(window.startIso, i);
        daily_series.push(
          dailyMap.get(date) ?? {
            date,
            orders: 0,
            delivered: 0,
            food_revenue: '0.00',
          },
        );
      }
    } else {
      for (const row of dailyRows.slice(-90)) {
        daily_series.push({
          date: row.date,
          orders: Number(row.orders),
          delivered: Number(row.delivered),
          food_revenue: row.food_revenue,
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
    const catAgg = new Map<string, { units: number; revenueCents: number }>();
    let totalItemsRevenueCents = 0;

    const aggregatedItems = new Map<
      string,
      {
        item_name: string;
        item_type: 'product' | 'offer';
        units_sold: number;
        revenueCents: number;
      }
    >();

    for (const row of itemRows) {
      const units = Number(row.units_sold);
      const revCents = Math.round(Number(row.revenue) * 100);
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

    const top_items = [...aggregatedItems.values()]
      .sort(
        (a, b) =>
          b.revenueCents - a.revenueCents || b.units_sold - a.units_sold,
      )
      .slice(0, 8)
      .map((item) => ({
        item_name: item.item_name,
        item_type: item.item_type,
        units_sold: item.units_sold,
        revenue: (item.revenueCents / 100).toFixed(2),
        share_pct: roundRate(item.revenueCents, totalItemsRevenueCents),
      }));

    const category_breakdown = [...catAgg.entries()]
      .sort((a, b) => b[1].revenueCents - a[1].revenueCents)
      .slice(0, 8)
      .map(([cat_title, agg]) => ({
        cat_title,
        units_sold: agg.units,
        revenue: (agg.revenueCents / 100).toFixed(2),
        share_pct: roundRate(agg.revenueCents, totalItemsRevenueCents),
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
          a.units_sold - b.units_sold || Number(b.price) - Number(a.price),
      )
      .slice(0, 5);

    const uniqueCustomers = loyaltyRows.length;
    const repeatCustomers = loyaltyRows.filter(
      (r) => Number(r.orders_count) >= 2,
    ).length;

    const totalOrders = Number(currentRow?.total_orders ?? 0);
    const deliveredOrders = Number(currentRow?.delivered_orders ?? 0);
    const rejectedOrders = Number(currentRow?.rejected_orders ?? 0);
    const cancelledOrders = Number(currentRow?.cancelled_orders ?? 0);
    const acceptedOrders = Number(currentRow?.accepted_orders ?? 0);
    const decidedOrders = acceptedOrders + rejectedOrders;

    return {
      range,
      generated_at: new Date(),
      kpis: {
        food_revenue: currentRow?.food_revenue ?? '0.00',
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
