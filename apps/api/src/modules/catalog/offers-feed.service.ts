import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PublicOfferFeedItemResponse } from './offers-feed.dto';

const cairoClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface RawOfferFeedRow {
  offer_id: string;
  rest_id: string;
  offer_title: string;
  offer_description: string | null;
  initial_price: string;
  real_price: string;
  offer_image_url: string | null;
  starts_at: Date | string;
  expires_at: Date | string;
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
  discount_percentage: number | string;
  orders_count: number | string;
  total_matches: number | string;
}

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function isOpenSql(cairoParam: string): string {
  return `(CASE WHEN r.opens_at < r.closes_at THEN (${cairoParam}::time >= r.opens_at AND ${cairoParam}::time < r.closes_at) ELSE (${cairoParam}::time >= r.opens_at OR ${cairoParam}::time < r.closes_at) END)`;
}

/**
 * Serves the global Home Page offers feed ranked by a composite relevance score
 * (recent popularity + discount value + freshness cold-start boost + ending-soon urgency)
 * with open-restaurant priority and per-restaurant diversity round-robin.
 */
@Injectable()
export class OffersFeedService {
  constructor(private readonly dataSource: DataSource) {}

  async listPublicOffersFeed(options: {
    skip: number;
    take: number;
    openOnly?: boolean;
  }): Promise<{ items: PublicOfferFeedItemResponse[]; total: number }> {
    const now = new Date();
    const cairoTime = cairoClockFormatter.format(now);
    const openOnly = options.openOnly ?? false;
    const openExpr = isOpenSql('$2');

    const sql = `
      WITH offer_demand AS (
        SELECT
          oi.offer_id,
          COALESCE(SUM(oi.quantity), 0)::int AS orders_30d,
          COALESCE(
            SUM(
              CASE
                WHEN ord.created_at >= ($1::timestamptz - INTERVAL '7 days')
                  THEN oi.quantity
                ELSE 0
              END
            ),
            0
          )::int AS orders_7d
        FROM order_items oi
        INNER JOIN orders ord
          ON ord.order_id = oi.order_id
         AND ord.rest_id = oi.rest_id
        WHERE oi.offer_id IS NOT NULL
          AND ord.created_at >= ($1::timestamptz - INTERVAL '30 days')
          AND ord.status NOT IN ('Cancelled', 'Rejected', 'Failed')
        GROUP BY oi.offer_id
      ),
      eligible AS (
        SELECT
          o.offer_id,
          o.rest_id,
          o.offer_title,
          o.offer_description,
          o.initial_price,
          o.real_price,
          o.offer_image_url,
          o.starts_at,
          o.expires_at,
          o.created_at,
          r.rest_title,
          r.rest_image_url_mobile,
          ${openExpr} AS is_open,
          COALESCE(d.orders_30d, 0)::int AS orders_count,
          COALESCE(d.orders_7d, 0)::int AS orders_7d,
          CASE
            WHEN o.initial_price > 0
              THEN GREATEST(0::numeric, (o.initial_price - o.real_price) / o.initial_price)
            ELSE 0::numeric
          END AS discount_ratio,
          GREATEST(
            0::double precision,
            EXTRACT(EPOCH FROM ($1::timestamptz - GREATEST(o.starts_at, o.created_at))) / 3600.0
          ) AS age_hours,
          GREATEST(
            0::double precision,
            EXTRACT(EPOCH FROM (o.expires_at - $1::timestamptz)) / 3600.0
          ) AS remaining_hours
        FROM offers o
        INNER JOIN restaurant_profiles r
          ON r.rest_id = o.rest_id
         AND r.activation_status = 'Active'
         AND r.is_active = true
        INNER JOIN users u
          ON u.user_id = r.user_id
         AND u.role = 'Restaurant'
         AND u.is_active = true
         AND u.email_verified_at IS NOT NULL
        LEFT JOIN offer_demand d
          ON d.offer_id = o.offer_id
        WHERE o.is_active = true
          AND o.starts_at <= $1::timestamptz
          AND o.expires_at > $1::timestamptz
          ${openOnly ? `AND ${openExpr}` : ''}
      ),
      scored AS (
        SELECT
          e.*,
          ROUND(e.discount_ratio * 100)::int AS discount_percentage,
          (
            LEAST(45.0::double precision, LN(1.0 + (e.orders_count + e.orders_7d)::double precision) * 12.0)
            + LEAST(25.0::double precision, e.discount_ratio::double precision * 50.0)
            + CASE
                WHEN e.age_hours <= 168.0
                  THEN 15.0 * (1.0 - e.age_hours / 168.0)
                ELSE 0.0
              END
            + CASE
                WHEN e.remaining_hours <= 48.0
                  THEN 15.0 * (1.0 - e.remaining_hours / 48.0)
                ELSE 0.0
              END
          ) AS rank_score
        FROM eligible e
      ),
      diversified AS (
        SELECT
          s.*,
          ROW_NUMBER() OVER (
            PARTITION BY s.is_open, s.rest_id
            ORDER BY s.rank_score DESC, s.starts_at DESC, s.offer_id DESC
          ) AS rest_slot,
          COUNT(*) OVER()::int AS total_matches
        FROM scored s
      )
      SELECT
        offer_id::text AS offer_id,
        rest_id::text AS rest_id,
        offer_title,
        offer_description,
        initial_price::text AS initial_price,
        real_price::text AS real_price,
        offer_image_url,
        starts_at,
        expires_at,
        rest_title,
        rest_image_url_mobile,
        is_open,
        discount_percentage,
        orders_count,
        total_matches
      FROM diversified
      ORDER BY
        is_open DESC,
        rest_slot ASC,
        rank_score DESC,
        starts_at DESC,
        offer_id DESC
      LIMIT $3
      OFFSET $4
    `;

    const rows = (await this.dataSource.query(sql, [
      now,
      cairoTime,
      options.take,
      options.skip,
    ])) as RawOfferFeedRow[];

    let total = rows.length ? Number(rows[0]!.total_matches) : 0;

    if (rows.length === 0 && options.skip > 0) {
      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM offers o
        INNER JOIN restaurant_profiles r
          ON r.rest_id = o.rest_id
         AND r.activation_status = 'Active'
         AND r.is_active = true
        INNER JOIN users u
          ON u.user_id = r.user_id
         AND u.role = 'Restaurant'
         AND u.is_active = true
         AND u.email_verified_at IS NOT NULL
        WHERE o.is_active = true
          AND o.starts_at <= $1::timestamptz
          AND o.expires_at > $1::timestamptz
          ${openOnly ? `AND ${openExpr}` : ''}
      `;
      const [countRow] = (await this.dataSource.query(
        countSql,
        openOnly ? [now, cairoTime] : [now],
      )) as Array<{ total: number | string }>;
      total = Number(countRow?.total ?? 0);
    }

    return {
      total,
      items: rows.map((row) => ({
        offer_id: row.offer_id,
        rest_id: row.rest_id,
        offer_title: row.offer_title,
        offer_description: row.offer_description ?? null,
        initial_price: row.initial_price,
        real_price: row.real_price,
        offer_image_url: row.offer_image_url ?? null,
        starts_at: toIso(row.starts_at),
        expires_at: toIso(row.expires_at),
        rest_title: row.rest_title,
        rest_image_url_mobile: row.rest_image_url_mobile ?? null,
        is_open: Boolean(row.is_open),
        discount_percentage: Number(row.discount_percentage),
        orders_count: Number(row.orders_count),
      })),
    };
  }
}
