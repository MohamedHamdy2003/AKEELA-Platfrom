import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  GlobalSearchResponse,
  SearchCategoryResult,
  SearchMatchSource,
  SearchOfferResult,
  SearchProductResult,
  SearchRestaurantResult,
  SearchType,
} from './search.dto';
import { buildSearchQueryTerms, SearchQueryTerms } from './search-text';

const cairoClockFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface SearchOptions {
  q: string;
  type?: SearchType;
  limit?: number;
  openOnly?: boolean;
  restId?: string;
}

interface QueryContext {
  manager: EntityManager;
  terms: SearchQueryTerms;
  limit: number;
  openOnly: boolean;
  restId?: string;
  cairoTime: string;
  now: Date;
}

interface RawRestaurantRow {
  rest_id: string;
  rest_title: string;
  rest_description: string | null;
  rest_image_url_mobile: string | null;
  rest_address: string;
  longitude: string;
  latitude: string;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
  matched_name: boolean;
  matched_desc: boolean;
  cat_matches: number;
  prod_matches: number;
  offer_matches: number;
  total_matches: number;
}

interface RawProductRow {
  prod_id: string;
  cat_id: string;
  cat_title: string;
  prod_name: string;
  prod_description: string | null;
  prod_image_url: string | null;
  price: string;
  rest_id: string;
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
  total_matches: number;
}

interface RawOfferRow {
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
  total_matches: number;
}

interface RawCategoryRow {
  cat_id: string;
  cat_title: string;
  display_order: number | string;
  rest_id: string;
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
  total_matches: number;
}

function isOpenSql(cairoParam: string): string {
  return `(CASE WHEN r.opens_at < r.closes_at THEN (${cairoParam}::time >= r.opens_at AND ${cairoParam}::time < r.closes_at) ELSE (${cairoParam}::time >= r.opens_at OR ${cairoParam}::time < r.closes_at) END)`;
}

function toIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

/**
 * Builds an index-friendly GIN trigram predicate for a normalized column expression.
 * Supports full-phrase substring, multi-token unordered matching (BitmapAnd), and
 * per-token word_similarity fuzzy typo tolerance for tokens of length >= 4.
 */
function buildColumnMatchSql(
  normExpr: string,
  terms: SearchQueryTerms,
  params: unknown[],
  allowFuzzy: boolean,
): string {
  const parts: string[] = [];

  params.push(terms.likeContains);
  parts.push(`${normExpr} LIKE $${params.length} ESCAPE '\\'`);

  if (terms.tokens.length > 1) {
    const tokenClauses = terms.tokens.map((token, index) => {
      params.push(terms.tokenPatterns[index]!);
      const likeClause = `${normExpr} LIKE $${params.length} ESCAPE '\\'`;
      if (allowFuzzy && token.length >= 4) {
        params.push(token);
        return `(${likeClause} OR $${params.length} <% ${normExpr})`;
      }
      return likeClause;
    });
    parts.push(`(${tokenClauses.join(' AND ')})`);
  } else if (allowFuzzy && terms.useFuzzy) {
    params.push(terms.normalized);
    parts.push(`$${params.length} <% ${normExpr}`);
  }

  return `(${parts.join(' OR ')})`;
}

@Injectable()
export class CatalogSearchService {
  constructor(private readonly dataSource: DataSource) {}

  async search(options: SearchOptions): Promise<GlobalSearchResponse> {
    const type: SearchType = options.type ?? 'all';
    const limit = options.limit ?? 10;
    const openOnly = options.openOnly ?? false;
    const terms = buildSearchQueryTerms(options.q);

    if (!terms.normalized) {
      return {
        query: terms.raw,
        normalized_query: '',
        type,
        counts: { restaurants: 0, products: 0, offers: 0, categories: 0 },
        restaurants: [],
        products: [],
        offers: [],
        categories: [],
      };
    }

    const now = new Date();
    const cairoTime = cairoClockFormatter.format(now);
    const runAll = type === 'all';

    // When fuzzy matching isn't needed (short/exact queries), skip opening a serializing
    // single-connection transaction and execute the requested entity searches in parallel.
    if (!terms.useFuzzy) {
      const ctx: QueryContext = {
        manager: this.dataSource.manager,
        terms,
        limit,
        openOnly,
        restId: options.restId,
        cairoTime,
        now,
      };
      const [restaurantsRes, productsRes, offersRes, categoriesRes] =
        await Promise.all([
          runAll || type === 'restaurants'
            ? this.searchRestaurants(ctx)
            : Promise.resolve({
                items: [] as SearchRestaurantResult[],
                total: 0,
              }),
          runAll || type === 'products'
            ? this.searchProducts(ctx)
            : Promise.resolve({ items: [] as SearchProductResult[], total: 0 }),
          runAll || type === 'offers'
            ? this.searchOffers(ctx)
            : Promise.resolve({ items: [] as SearchOfferResult[], total: 0 }),
          runAll || type === 'categories'
            ? this.searchCategories(ctx)
            : Promise.resolve({
                items: [] as SearchCategoryResult[],
                total: 0,
              }),
        ]);
      return {
        query: terms.raw,
        normalized_query: terms.normalized,
        type,
        counts: {
          restaurants: restaurantsRes.total,
          products: productsRes.total,
          offers: offersRes.total,
          categories: categoriesRes.total,
        },
        restaurants: restaurantsRes.items,
        products: productsRes.items,
        offers: offersRes.items,
        categories: categoriesRes.items,
      };
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      if (terms.useFuzzy) {
        await manager.query(
          'SET LOCAL pg_trgm.word_similarity_threshold = 0.35',
        );
      }

      const ctx: QueryContext = {
        manager,
        terms,
        limit,
        openOnly,
        restId: options.restId,
        cairoTime,
        now,
      };

      const restaurantsRes =
        runAll || type === 'restaurants'
          ? await this.searchRestaurants(ctx)
          : { items: [] as SearchRestaurantResult[], total: 0 };
      const productsRes =
        runAll || type === 'products'
          ? await this.searchProducts(ctx)
          : { items: [] as SearchProductResult[], total: 0 };
      const offersRes =
        runAll || type === 'offers'
          ? await this.searchOffers(ctx)
          : { items: [] as SearchOfferResult[], total: 0 };
      const categoriesRes =
        runAll || type === 'categories'
          ? await this.searchCategories(ctx)
          : { items: [] as SearchCategoryResult[], total: 0 };

      return {
        query: terms.raw,
        normalized_query: terms.normalized,
        type,
        counts: {
          restaurants: restaurantsRes.total,
          products: productsRes.total,
          offers: offersRes.total,
          categories: categoriesRes.total,
        },
        restaurants: restaurantsRes.items,
        products: productsRes.items,
        offers: offersRes.items,
        categories: categoriesRes.items,
      };
    });
  }

  private async searchProducts(
    ctx: QueryContext,
  ): Promise<{ items: SearchProductResult[]; total: number }> {
    const params: unknown[] = [
      ctx.terms.normalized,
      ctx.terms.likePrefix,
      ctx.terms.likeContains,
      ctx.cairoTime,
    ];
    const openExpr = isOpenSql('$4');
    const nameNorm = 'normalize_search_text(p.prod_name)';
    const descNorm = "normalize_search_text(COALESCE(p.prod_description, ''))";
    const catNorm = 'normalize_search_text(c.cat_title)';

    const nameMatch = buildColumnMatchSql(nameNorm, ctx.terms, params, true);
    const descMatch = buildColumnMatchSql(descNorm, ctx.terms, params, false);
    const catMatch = buildColumnMatchSql(catNorm, ctx.terms, params, false);

    const extraFilters: string[] = [];
    if (ctx.restId) {
      params.push(ctx.restId);
      extraFilters.push(`r.rest_id = $${params.length}`);
    }
    if (ctx.openOnly) {
      extraFilters.push(openExpr);
    }

    params.push(ctx.limit);
    const limitParam = `$${params.length}`;

    const scoreExpr = `
      (
        CASE
          WHEN ${nameNorm} = $1 THEN 100
          WHEN ${nameNorm} LIKE $2 ESCAPE '\\' THEN 80
          WHEN ${nameNorm} LIKE $3 ESCAPE '\\' THEN 60
          ELSE 0
        END
        + CASE WHEN ${catNorm} LIKE $3 ESCAPE '\\' THEN 42 ELSE 0 END
        + CASE WHEN ${descNorm} LIKE $3 ESCAPE '\\' THEN 24 ELSE 0 END
        + (word_similarity($1, ${nameNorm}) * 35)
        + CASE WHEN ${openExpr} THEN 10 ELSE 0 END
      )
    `;

    const sql = `
      SELECT
        p.prod_id::text AS prod_id,
        p.cat_id::text AS cat_id,
        c.cat_title,
        p.prod_name,
        p.prod_description,
        p.prod_image_url,
        p.price::text AS price,
        r.rest_id::text AS rest_id,
        r.rest_title,
        r.rest_image_url_mobile,
        ${openExpr} AS is_open,
        COUNT(*) OVER()::int AS total_matches
      FROM products p
      INNER JOIN categories c
        ON c.cat_id = p.cat_id
       AND c.rest_id = p.rest_id
       AND c.is_active = true
      INNER JOIN restaurant_profiles r
        ON r.rest_id = p.rest_id
       AND r.activation_status = 'Active'
       AND r.is_active = true
      INNER JOIN users u
        ON u.user_id = r.user_id
       AND u.role = 'Restaurant'
       AND u.is_active = true
       AND u.email_verified_at IS NOT NULL
      WHERE p.is_active = true
        AND p.cat_id IS NOT NULL
        AND (${nameMatch} OR ${descMatch} OR ${catMatch})
        ${extraFilters.length ? `AND ${extraFilters.join(' AND ')}` : ''}
      ORDER BY ${scoreExpr} DESC, is_open DESC, p.prod_id DESC
      LIMIT ${limitParam}
    `;

    const rows = (await ctx.manager.query(sql, params)) as RawProductRow[];
    const total = rows.length ? Number(rows[0]!.total_matches) : 0;

    return {
      total,
      items: rows.map((row) => ({
        prod_id: row.prod_id,
        cat_id: row.cat_id,
        cat_title: row.cat_title,
        prod_name: row.prod_name,
        prod_description: row.prod_description ?? null,
        prod_image_url: row.prod_image_url ?? null,
        price: row.price,
        rest_id: row.rest_id,
        rest_title: row.rest_title,
        rest_image_url_mobile: row.rest_image_url_mobile ?? null,
        is_open: Boolean(row.is_open),
      })),
    };
  }

  private async searchOffers(
    ctx: QueryContext,
  ): Promise<{ items: SearchOfferResult[]; total: number }> {
    const params: unknown[] = [
      ctx.terms.normalized,
      ctx.terms.likePrefix,
      ctx.terms.likeContains,
      ctx.cairoTime,
      ctx.now,
    ];
    const openExpr = isOpenSql('$4');
    const titleNorm = 'normalize_search_text(o.offer_title)';
    const descNorm = "normalize_search_text(COALESCE(o.offer_description, ''))";

    const titleMatch = buildColumnMatchSql(titleNorm, ctx.terms, params, true);
    const descMatch = buildColumnMatchSql(descNorm, ctx.terms, params, false);

    const extraFilters: string[] = [];
    if (ctx.restId) {
      params.push(ctx.restId);
      extraFilters.push(`r.rest_id = $${params.length}`);
    }
    if (ctx.openOnly) {
      extraFilters.push(openExpr);
    }

    params.push(ctx.limit);
    const limitParam = `$${params.length}`;

    const scoreExpr = `
      (
        CASE
          WHEN ${titleNorm} = $1 THEN 100
          WHEN ${titleNorm} LIKE $2 ESCAPE '\\' THEN 80
          WHEN ${titleNorm} LIKE $3 ESCAPE '\\' THEN 60
          ELSE 0
        END
        + CASE WHEN ${descNorm} LIKE $3 ESCAPE '\\' THEN 25 ELSE 0 END
        + (word_similarity($1, ${titleNorm}) * 35)
        + CASE WHEN ${openExpr} THEN 10 ELSE 0 END
      )
    `;

    const sql = `
      SELECT
        o.offer_id::text AS offer_id,
        o.rest_id::text AS rest_id,
        o.offer_title,
        o.offer_description,
        o.initial_price::text AS initial_price,
        o.real_price::text AS real_price,
        o.offer_image_url,
        o.starts_at,
        o.expires_at,
        r.rest_title,
        r.rest_image_url_mobile,
        ${openExpr} AS is_open,
        COUNT(*) OVER()::int AS total_matches
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
        AND o.starts_at <= $5
        AND o.expires_at > $5
        AND (${titleMatch} OR ${descMatch})
        ${extraFilters.length ? `AND ${extraFilters.join(' AND ')}` : ''}
      ORDER BY ${scoreExpr} DESC, is_open DESC, o.starts_at DESC, o.offer_id DESC
      LIMIT ${limitParam}
    `;

    const rows = (await ctx.manager.query(sql, params)) as RawOfferRow[];
    const total = rows.length ? Number(rows[0]!.total_matches) : 0;

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
      })),
    };
  }

  private async searchCategories(
    ctx: QueryContext,
  ): Promise<{ items: SearchCategoryResult[]; total: number }> {
    const params: unknown[] = [
      ctx.terms.normalized,
      ctx.terms.likePrefix,
      ctx.terms.likeContains,
      ctx.cairoTime,
    ];
    const openExpr = isOpenSql('$4');
    const titleNorm = 'normalize_search_text(c.cat_title)';
    const titleMatch = buildColumnMatchSql(titleNorm, ctx.terms, params, true);

    const extraFilters: string[] = [];
    if (ctx.restId) {
      params.push(ctx.restId);
      extraFilters.push(`r.rest_id = $${params.length}`);
    }
    if (ctx.openOnly) {
      extraFilters.push(openExpr);
    }

    params.push(ctx.limit);
    const limitParam = `$${params.length}`;

    const scoreExpr = `
      (
        CASE
          WHEN ${titleNorm} = $1 THEN 100
          WHEN ${titleNorm} LIKE $2 ESCAPE '\\' THEN 80
          WHEN ${titleNorm} LIKE $3 ESCAPE '\\' THEN 60
          ELSE 0
        END
        + (word_similarity($1, ${titleNorm}) * 35)
        + CASE WHEN ${openExpr} THEN 10 ELSE 0 END
      )
    `;

    const sql = `
      SELECT
        c.cat_id::text AS cat_id,
        c.cat_title,
        c.display_order,
        r.rest_id::text AS rest_id,
        r.rest_title,
        r.rest_image_url_mobile,
        ${openExpr} AS is_open,
        COUNT(*) OVER()::int AS total_matches
      FROM categories c
      INNER JOIN restaurant_profiles r
        ON r.rest_id = c.rest_id
       AND r.activation_status = 'Active'
       AND r.is_active = true
      INNER JOIN users u
        ON u.user_id = r.user_id
       AND u.role = 'Restaurant'
       AND u.is_active = true
       AND u.email_verified_at IS NOT NULL
      WHERE c.is_active = true
        AND ${titleMatch}
        ${extraFilters.length ? `AND ${extraFilters.join(' AND ')}` : ''}
      ORDER BY ${scoreExpr} DESC, is_open DESC, c.display_order ASC, c.cat_id ASC
      LIMIT ${limitParam}
    `;

    const rows = (await ctx.manager.query(sql, params)) as RawCategoryRow[];
    const total = rows.length ? Number(rows[0]!.total_matches) : 0;

    return {
      total,
      items: rows.map((row) => ({
        cat_id: row.cat_id,
        cat_title: row.cat_title,
        display_order: Number(row.display_order),
        rest_id: row.rest_id,
        rest_title: row.rest_title,
        rest_image_url_mobile: row.rest_image_url_mobile ?? null,
        is_open: Boolean(row.is_open),
      })),
    };
  }

  private async searchRestaurants(
    ctx: QueryContext,
  ): Promise<{ items: SearchRestaurantResult[]; total: number }> {
    const params: unknown[] = [
      ctx.terms.normalized,
      ctx.terms.likePrefix,
      ctx.terms.likeContains,
      ctx.cairoTime,
      ctx.now,
    ];
    const openExpr = isOpenSql('$4');

    const restTitleNorm = 'normalize_search_text(r.rest_title)';
    const restDescNorm =
      "normalize_search_text(COALESCE(r.rest_description, ''))";
    const catTitleNorm = 'normalize_search_text(c.cat_title)';
    const prodNameNorm = 'normalize_search_text(p.prod_name)';
    const prodDescNorm =
      "normalize_search_text(COALESCE(p.prod_description, ''))";
    const offerTitleNorm = 'normalize_search_text(o.offer_title)';
    const offerDescNorm =
      "normalize_search_text(COALESCE(o.offer_description, ''))";

    const restTitleMatch = buildColumnMatchSql(
      restTitleNorm,
      ctx.terms,
      params,
      true,
    );
    const restDescMatch = buildColumnMatchSql(
      restDescNorm,
      ctx.terms,
      params,
      false,
    );
    const catMatch = buildColumnMatchSql(catTitleNorm, ctx.terms, params, true);
    const prodNameMatch = buildColumnMatchSql(
      prodNameNorm,
      ctx.terms,
      params,
      true,
    );
    const prodDescMatch = buildColumnMatchSql(
      prodDescNorm,
      ctx.terms,
      params,
      false,
    );
    const offerTitleMatch = buildColumnMatchSql(
      offerTitleNorm,
      ctx.terms,
      params,
      true,
    );
    const offerDescMatch = buildColumnMatchSql(
      offerDescNorm,
      ctx.terms,
      params,
      false,
    );

    const extraFilters: string[] = [];
    let restIdParam: string | null = null;
    if (ctx.restId) {
      params.push(ctx.restId);
      restIdParam = `$${params.length}`;
      extraFilters.push(`r.rest_id = ${restIdParam}`);
    }
    if (ctx.openOnly) {
      extraFilters.push(openExpr);
    }

    params.push(ctx.limit);
    const limitParam = `$${params.length}`;

    const sql = `
      WITH signals AS (
        SELECT
          r.rest_id,
          CASE WHEN ${restTitleMatch} THEN 1 ELSE 0 END AS matched_name,
          CASE WHEN ${restDescMatch} THEN 1 ELSE 0 END AS matched_desc,
          0::int AS cat_matches,
          0::int AS prod_matches,
          0::int AS offer_matches
        FROM restaurant_profiles r
        WHERE r.activation_status = 'Active'
          AND r.is_active = true
          ${restIdParam ? `AND r.rest_id = ${restIdParam}` : ''}
          AND (${restTitleMatch} OR ${restDescMatch})

        UNION ALL

        SELECT
          c.rest_id,
          0 AS matched_name,
          0 AS matched_desc,
          COUNT(*)::int AS cat_matches,
          0::int AS prod_matches,
          0::int AS offer_matches
        FROM categories c
        WHERE c.is_active = true
          ${restIdParam ? `AND c.rest_id = ${restIdParam}` : ''}
          AND ${catMatch}
        GROUP BY c.rest_id

        UNION ALL

        SELECT
          p.rest_id,
          0 AS matched_name,
          0 AS matched_desc,
          0::int AS cat_matches,
          COUNT(*)::int AS prod_matches,
          0::int AS offer_matches
        FROM products p
        INNER JOIN categories c
          ON c.cat_id = p.cat_id
         AND c.rest_id = p.rest_id
         AND c.is_active = true
        WHERE p.is_active = true
          AND p.cat_id IS NOT NULL
          ${restIdParam ? `AND p.rest_id = ${restIdParam}` : ''}
          AND (${prodNameMatch} OR ${prodDescMatch})
        GROUP BY p.rest_id

        UNION ALL

        SELECT
          o.rest_id,
          0 AS matched_name,
          0 AS matched_desc,
          0::int AS cat_matches,
          0::int AS prod_matches,
          COUNT(*)::int AS offer_matches
        FROM offers o
        WHERE o.is_active = true
          AND o.starts_at <= $5
          AND o.expires_at > $5
          ${restIdParam ? `AND o.rest_id = ${restIdParam}` : ''}
          AND (${offerTitleMatch} OR ${offerDescMatch})
        GROUP BY o.rest_id
      ),
      aggregated AS (
        SELECT
          rest_id,
          MAX(matched_name) > 0 AS matched_name,
          MAX(matched_desc) > 0 AS matched_desc,
          SUM(cat_matches)::int AS cat_matches,
          SUM(prod_matches)::int AS prod_matches,
          SUM(offer_matches)::int AS offer_matches
        FROM signals
        GROUP BY rest_id
      )
      SELECT
        r.rest_id::text AS rest_id,
        r.rest_title,
        r.rest_description,
        r.rest_image_url_mobile,
        r.rest_address,
        r.longitude::text AS longitude,
        r.latitude::text AS latitude,
        r.opens_at::text AS opens_at,
        r.closes_at::text AS closes_at,
        ${openExpr} AS is_open,
        a.matched_name,
        a.matched_desc,
        a.cat_matches,
        a.prod_matches,
        a.offer_matches,
        COUNT(*) OVER()::int AS total_matches
      FROM aggregated a
      INNER JOIN restaurant_profiles r
        ON r.rest_id = a.rest_id
       AND r.activation_status = 'Active'
       AND r.is_active = true
      INNER JOIN users u
        ON u.user_id = r.user_id
       AND u.role = 'Restaurant'
       AND u.is_active = true
       AND u.email_verified_at IS NOT NULL
      ${extraFilters.length ? `WHERE ${extraFilters.join(' AND ')}` : ''}
      ORDER BY
        (
          CASE
            WHEN ${restTitleNorm} = $1 THEN 130
            WHEN ${restTitleNorm} LIKE $2 ESCAPE '\\' THEN 105
            WHEN ${restTitleNorm} LIKE $3 ESCAPE '\\' THEN 85
            WHEN a.matched_name THEN 60 + (word_similarity($1, ${restTitleNorm}) * 25)
            ELSE 0
          END
          + CASE WHEN a.matched_desc THEN 30 ELSE 0 END
          + CASE WHEN a.cat_matches > 0 THEN 40 ELSE 0 END
          + CASE WHEN a.prod_matches > 0 THEN 35 + LEAST(a.prod_matches, 10) * 3 ELSE 0 END
          + CASE WHEN a.offer_matches > 0 THEN 28 + LEAST(a.offer_matches, 5) * 2 ELSE 0 END
          + CASE WHEN ${openExpr} THEN 12 ELSE 0 END
        ) DESC,
        is_open DESC,
        (a.prod_matches + a.offer_matches + a.cat_matches) DESC,
        r.rest_id ASC
      LIMIT ${limitParam}
    `;

    const rows = (await ctx.manager.query(sql, params)) as RawRestaurantRow[];
    const total = rows.length ? Number(rows[0]!.total_matches) : 0;

    return {
      total,
      items: rows.map((row) => {
        const matchedIn: SearchMatchSource[] = [];
        if (row.matched_name) matchedIn.push('name');
        if (row.matched_desc) matchedIn.push('description');
        if (Number(row.cat_matches) > 0) matchedIn.push('category');
        if (Number(row.prod_matches) > 0) matchedIn.push('product');
        if (Number(row.offer_matches) > 0) matchedIn.push('offer');

        return {
          rest_id: row.rest_id,
          rest_title: row.rest_title,
          rest_description: row.rest_description ?? null,
          rest_image_url_mobile: row.rest_image_url_mobile ?? null,
          rest_address: row.rest_address,
          longitude: Number(row.longitude).toFixed(7),
          latitude: Number(row.latitude).toFixed(7),
          opens_at: row.opens_at,
          closes_at: row.closes_at,
          is_open: Boolean(row.is_open),
          matched_in: matchedIn,
          matching_items_count:
            Number(row.prod_matches) + Number(row.offer_matches),
        };
      }),
    };
  }
}
