import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DeliveryService } from '../delivery/delivery.service';
import { Order, OrderStatus } from './entities/order.entity';
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
export class DeliveryAnalyticsService {
  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
  ) {}

  private async assertActiveCompany(actor: AuthActor): Promise<string> {
    if (actor.role !== 'Delivery_Company') {
      throw new ApiError(403, 'FORBIDDEN', 'Delivery_Company access required.');
    }
    const account = await this.users.byId(actor.userId);
    if (
      !account ||
      account.role !== 'Delivery_Company' ||
      !account.is_active ||
      !account.email_verified_at
    ) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'An active verified delivery company account is required.',
      );
    }
    const company = await this.delivery.ownedProfile(actor.userId);
    if (!company.is_active) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Delivery company profile must be active.',
      );
    }
    return company.company_id;
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
    const companyId = await this.assertActiveCompany(actor);
    const window = await this.resolveWindow(range);
    const ordersRepo = this.db.getRepository(Order);

    const kpiQuery = (start: Date | null, end: Date | null) => {
      const qb = ordersRepo
        .createQueryBuilder('o')
        .select('COUNT(*)::int', 'assigned_orders')
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
          'delivered_orders',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE o.status = 'Failed')::int",
          'failed_orders',
        )
        .addSelect(
          "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'delivery_fees_earned',
        )
        .addSelect(
          "COALESCE(ROUND(AVG(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 2), 0)::numeric(14,2)",
          'avg_delivery_fee',
        )
        .addSelect(
          "COALESCE(SUM(o.total_price) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
          'cod_collected_value',
        )
        .addSelect(
          "ROUND(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0) FILTER (WHERE o.status = 'Delivered' AND o.updated_at >= o.created_at)::numeric, 1)",
          'avg_fulfillment_minutes',
        )
        .where('o.company_id = :companyId', { companyId });
      if (start) qb.andWhere('o.created_at >= :start', { start });
      if (end) qb.andWhere('o.created_at < :end', { end });
      return qb.getRawOne<{
        assigned_orders: number;
        delivered_orders: number;
        failed_orders: number;
        delivery_fees_earned: string;
        avg_delivery_fee: string;
        cod_collected_value: string;
        avg_fulfillment_minutes: string | null;
      }>();
    };

    const statusQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .where('o.company_id = :companyId', { companyId })
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
      .addSelect('COUNT(*)::int', 'assigned')
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
        'delivered',
      )
      .addSelect("COUNT(*) FILTER (WHERE o.status = 'Failed')::int", 'failed')
      .addSelect(
        "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'delivery_fees',
      )
      .where('o.company_id = :companyId', { companyId })
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
      .where('o.company_id = :companyId', { companyId })
      .groupBy(
        "EXTRACT(HOUR FROM (o.created_at AT TIME ZONE 'Africa/Cairo'))::int",
      );
    if (window.since) {
      hoursQb.andWhere('o.created_at >= :since', { since: window.since });
    }

    const driverStatsQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.driver_id', 'driver_id')
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
        'delivered_orders',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Failed')::int",
        'failed_orders',
      )
      .addSelect(
        "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'delivery_fees',
      )
      .addSelect(
        "ROUND(AVG(EXTRACT(EPOCH FROM (o.updated_at - o.created_at)) / 60.0) FILTER (WHERE o.status = 'Delivered' AND o.updated_at >= o.created_at)::numeric, 1)",
        'avg_fulfillment_minutes',
      )
      .where('o.company_id = :companyId AND o.driver_id IS NOT NULL', {
        companyId,
      })
      .groupBy('o.driver_id');
    if (window.since) {
      driverStatsQb.andWhere('o.created_at >= :since', { since: window.since });
    }

    const restQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.rest_id', 'rest_id')
      .addSelect('COUNT(*)::int', 'assigned_orders')
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Delivered')::int",
        'delivered_orders',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Failed')::int",
        'failed_orders',
      )
      .addSelect(
        "COALESCE(SUM(o.delivery_fee) FILTER (WHERE o.status = 'Delivered'), 0)::numeric(14,2)",
        'delivery_fees',
      )
      .where('o.company_id = :companyId', { companyId })
      .groupBy('o.rest_id')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy("COUNT(*) FILTER (WHERE o.status = 'Delivered')", 'DESC')
      .limit(5);
    if (window.since) {
      restQb.andWhere('o.created_at >= :since', { since: window.since });
    }

    const staleUnassignedCutoff = new Date(Date.now() - 15 * 60 * 1000);
    const longTransitCutoff = new Date(Date.now() - 60 * 60 * 1000);

    const liveQueueQb = ordersRepo
      .createQueryBuilder('o')
      .select(
        "COUNT(*) FILTER (WHERE o.status = 'Accepted' AND o.driver_id IS NULL)::int",
        'unassigned_accepted',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Picked_Up')::int",
        'in_transit',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Accepted' AND o.driver_id IS NULL AND o.updated_at <= :staleUnassignedCutoff)::int",
        'stale_unassigned',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE o.status = 'Picked_Up' AND o.updated_at <= :longTransitCutoff)::int",
        'long_in_transit',
      )
      .where('o.company_id = :companyId', {
        companyId,
        staleUnassignedCutoff,
        longTransitCutoff,
      });

    const liveDriverLoadsQb = ordersRepo
      .createQueryBuilder('o')
      .select('o.driver_id', 'driver_id')
      .addSelect('COUNT(*)::int', 'active_load')
      .where(
        "o.company_id = :companyId AND o.status IN ('Accepted', 'Picked_Up') AND o.driver_id IS NOT NULL",
        { companyId },
      )
      .groupBy('o.driver_id');

    const [
      currentRow,
      prevRow,
      statusRows,
      dailyRows,
      hourRows,
      driverStatsRows,
      restRows,
      liveQueueRow,
      liveDriverLoadRows,
      ownedDrivers,
    ] = await Promise.all([
      kpiQuery(window.since, null),
      window.since && window.prevSince
        ? kpiQuery(window.prevSince, window.since)
        : Promise.resolve(null),
      statusQb.getRawMany<{ status: OrderStatus; count: number }>(),
      dailyQb.getRawMany<{
        date: string;
        assigned: number;
        delivered: number;
        failed: number;
        delivery_fees: string;
      }>(),
      hoursQb.getRawMany<{ hour: number; orders: number }>(),
      driverStatsQb.getRawMany<{
        driver_id: string;
        delivered_orders: number;
        failed_orders: number;
        delivery_fees: string;
        avg_fulfillment_minutes: string | null;
      }>(),
      restQb.getRawMany<{
        rest_id: string;
        assigned_orders: number;
        delivered_orders: number;
        failed_orders: number;
        delivery_fees: string;
      }>(),
      liveQueueQb.getRawOne<{
        unassigned_accepted: number;
        in_transit: number;
        stale_unassigned: number;
        long_in_transit: number;
      }>(),
      liveDriverLoadsQb.getRawMany<{
        driver_id: string;
        active_load: number;
      }>(),
      this.delivery.companyDrivers(companyId),
    ]);

    const status_breakdown = {
      Accepted: 0,
      Picked_Up: 0,
      Delivered: 0,
      Failed: 0,
    };
    for (const row of statusRows) {
      if (row.status in status_breakdown) {
        status_breakdown[row.status as keyof typeof status_breakdown] = Number(
          row.count,
        );
      }
    }

    const dailyMap = new Map(
      dailyRows.map((row) => [
        row.date,
        {
          date: row.date,
          assigned: Number(row.assigned),
          delivered: Number(row.delivered),
          failed: Number(row.failed),
          delivery_fees: row.delivery_fees,
        },
      ]),
    );
    const daily_series: Array<{
      date: string;
      assigned: number;
      delivered: number;
      failed: number;
      delivery_fees: string;
    }> = [];
    if (window.startIso && window.days) {
      for (let i = 0; i < window.days; i += 1) {
        const date = addDaysIso(window.startIso, i);
        daily_series.push(
          dailyMap.get(date) ?? {
            date,
            assigned: 0,
            delivered: 0,
            failed: 0,
            delivery_fees: '0.00',
          },
        );
      }
    } else {
      for (const row of dailyRows.slice(-90)) {
        daily_series.push({
          date: row.date,
          assigned: Number(row.assigned),
          delivered: Number(row.delivered),
          failed: Number(row.failed),
          delivery_fees: row.delivery_fees,
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

    const liveLoadMap = new Map(
      liveDriverLoadRows.map((row) => [row.driver_id, Number(row.active_load)]),
    );
    const driverStatsMap = new Map(
      driverStatsRows.map((row) => [row.driver_id, row]),
    );

    let activeDrivers = 0;
    let inactiveDrivers = 0;
    let busyDrivers = 0;
    let busyActiveDrivers = 0;
    let inactiveDriverOrders = 0;

    const driverLeaderboard = ownedDrivers
      .map((driver) => {
        const currentLoad = liveLoadMap.get(driver.driver_id) ?? 0;
        const stats = driverStatsMap.get(driver.driver_id);
        const delivered = Number(stats?.delivered_orders ?? 0);
        const failed = Number(stats?.failed_orders ?? 0);
        const closed = delivered + failed;

        if (driver.is_active) {
          activeDrivers += 1;
          if (currentLoad > 0) busyActiveDrivers += 1;
        } else {
          inactiveDrivers += 1;
          inactiveDriverOrders += currentLoad;
        }
        if (currentLoad > 0) busyDrivers += 1;

        return {
          driver_id: driver.driver_id,
          driver_name: driver.driver_name,
          driver_phone: driver.driver_phone,
          is_active: driver.is_active,
          current_load: currentLoad,
          delivered_orders: delivered,
          failed_orders: failed,
          delivery_fees: stats?.delivery_fees ?? '0.00',
          avg_fulfillment_minutes: parseOptionalMinutes(
            stats?.avg_fulfillment_minutes,
          ),
          success_rate: roundRate(delivered, closed),
        };
      })
      .sort(
        (a, b) =>
          b.delivered_orders - a.delivered_orders ||
          b.current_load - a.current_load ||
          Number(b.is_active) - Number(a.is_active) ||
          a.driver_name.localeCompare(b.driver_name, 'ar'),
      )
      .slice(0, 12);

    const restTitles = await this.restaurants.titlesByIds(
      restRows.map((row) => row.rest_id),
    );
    const top_pickup_restaurants = restRows.map((row) => ({
      rest_id: row.rest_id,
      rest_title: restTitles.get(row.rest_id) ?? `#${row.rest_id}`,
      assigned_orders: Number(row.assigned_orders),
      delivered_orders: Number(row.delivered_orders),
      failed_orders: Number(row.failed_orders),
      delivery_fees: row.delivery_fees,
    }));

    const assignedOrders = Number(currentRow?.assigned_orders ?? 0);
    const deliveredOrders = Number(currentRow?.delivered_orders ?? 0);
    const failedOrders = Number(currentRow?.failed_orders ?? 0);
    const closedOrders = deliveredOrders + failedOrders;

    return {
      range,
      generated_at: new Date(),
      kpis: {
        delivery_fees_earned: currentRow?.delivery_fees_earned ?? '0.00',
        avg_delivery_fee: currentRow?.avg_delivery_fee ?? '0.00',
        cod_collected_value: currentRow?.cod_collected_value ?? '0.00',
        assigned_orders: assignedOrders,
        delivered_orders: deliveredOrders,
        failed_orders: failedOrders,
        delivery_success_rate: roundRate(deliveredOrders, closedOrders),
        failure_rate: roundRate(failedOrders, closedOrders),
        avg_fulfillment_minutes: parseOptionalMinutes(
          currentRow?.avg_fulfillment_minutes,
        ),
      },
      previous_kpis: prevRow
        ? {
            delivery_fees_earned: prevRow.delivery_fees_earned ?? '0.00',
            cod_collected_value: prevRow.cod_collected_value ?? '0.00',
            assigned_orders: Number(prevRow.assigned_orders ?? 0),
            delivered_orders: Number(prevRow.delivered_orders ?? 0),
            failed_orders: Number(prevRow.failed_orders ?? 0),
            avg_fulfillment_minutes: parseOptionalMinutes(
              prevRow.avg_fulfillment_minutes,
            ),
          }
        : null,
      live_queue: {
        unassigned_accepted: Number(liveQueueRow?.unassigned_accepted ?? 0),
        in_transit: Number(liveQueueRow?.in_transit ?? 0),
        stale_unassigned: Number(liveQueueRow?.stale_unassigned ?? 0),
        long_in_transit: Number(liveQueueRow?.long_in_transit ?? 0),
        inactive_driver_orders: inactiveDriverOrders,
      },
      status_breakdown,
      daily_series,
      peak_hours,
      fleet: {
        total_drivers: ownedDrivers.length,
        active_drivers: activeDrivers,
        inactive_drivers: inactiveDrivers,
        busy_drivers: busyDrivers,
        idle_active_drivers: Math.max(0, activeDrivers - busyActiveDrivers),
      },
      driver_leaderboard: driverLeaderboard,
      top_pickup_restaurants,
    };
  }
}
