import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import request from 'supertest';
import { configureApplication } from '../../src/bootstrap';

loadEnv({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl)
  throw new Error(
    'TEST_DATABASE_URL is required for PostgreSQL integration tests.',
  );
const parsed = new URL(testUrl);
if (
  !parsed.pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(parsed.hostname)
)
  throw new Error(
    'Integration tests require a dedicated local database ending in _test.',
  );

Object.assign(process.env, {
  NODE_ENV: 'test',
  DEFAULT_DELIVERY_COMPANY_ID: '',
  DATABASE_URL: testUrl,
  DATABASE_SSL: 'false',
  TRUST_PROXY: 'false',
  JWT_SECRET: 'test-only-jwt-012345678901234567890123456',
  OTP_SECRET: 'test-only-otp-012345678901234567890123456',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '11025',
  SMTP_SECURE: 'false',
  SMTP_REQUIRE_TLS: 'false',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  AUTH_RATE_IP_LIMIT: '10000',
  AUTH_RATE_ACCOUNT_LIMIT: '10000',
  OTP_RESEND_SECONDS: '60',
  OTP_MAX_ATTEMPTS: '5',
  OTP_TTL_SECONDS: '600',
});

let app: INestApplication;
let db: DataSource;

const commonPassword = 'TestPassword123';
let customerUserId: string;
let restAId: string;
let restBId: string;
let restCId: string;
let closedRestId: string;

let offerAPopularId: string;
let offerASecondId: string;
let offerACancelledOnlyId: string;
let offerBHighDiscountId: string;
let offerCUrgentId: string;
let offerClosedId: string;

function api() {
  return request(app.getHttpServer());
}

async function createRestaurant(opts: {
  email: string;
  phone: string;
  title: string;
  opensAt?: string;
  closesAt?: string;
  activationStatus?: 'Active' | 'Pending';
}) {
  const reg = await api()
    .post('/api/v1/auth/register/restaurant')
    .send({
      full_name: `Owner ${opts.title}`,
      email: opts.email,
      password: commonPassword,
      phone: opts.phone,
      profile: {
        rest_title: opts.title,
        rest_description: 'Test restaurant',
        rest_address: '10 Main St, Ismailia',
        longitude: '32.2723000',
        latitude: '30.5965000',
        opens_at: opts.opensAt ?? '00:00:00',
        closes_at: opts.closesAt ?? '23:59:59',
      },
    });
  assert.equal(reg.status, 201);
  const restId = reg.body.data.profile.rest_id as string;
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [opts.email],
  );
  if (opts.activationStatus === 'Active') {
    await db.query(
      `UPDATE restaurant_profiles SET activation_status = 'Active', is_active = true WHERE rest_id = $1`,
      [restId],
    );
  }
  const login = await api().post('/api/v1/auth/login').send({
    email: opts.email,
    password: commonPassword,
  });
  assert.equal(login.status, 200);
  return { restId, token: login.body.data.tokens.access_token as string };
}

async function createOffer(
  token: string,
  payload: {
    title: string;
    initialPrice: string;
    realPrice: string;
    isActive?: boolean;
  },
): Promise<string> {
  const now = Date.now();
  const res = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      offer_title: payload.title,
      offer_description: 'Test offer description',
      initial_price: payload.initialPrice,
      real_price: payload.realPrice,
      is_active: payload.isActive ?? true,
      starts_at: new Date(now + 3600_000).toISOString(),
      expires_at: new Date(now + 30 * 86400_000).toISOString(),
    });
  assert.equal(res.status, 201);
  return res.body.data.offer_id as string;
}

async function seedOfferOrder(opts: {
  restId: string;
  offerId: string;
  status: string;
  quantity: number;
  daysAgo: number;
}) {
  const [order] = (await db.query(
    `INSERT INTO orders (customer_id, rest_id, status, total_price, customer_address, delivery_longitude, delivery_latitude, delivery_fee, created_at, updated_at)
     VALUES ($1, $2, $3, '150.00', 'Ismailia', 32.2723000, 30.5965000, '30.00', NOW() - ($4::int * INTERVAL '1 day'), NOW() - ($4::int * INTERVAL '1 day'))
     RETURNING order_id`,
    [customerUserId, opts.restId, opts.status, opts.daysAgo],
  )) as Array<{ order_id: string }>;

  await db.query(
    `INSERT INTO order_items (order_id, rest_id, offer_id, item_name, quantity, unit_price)
     VALUES ($1, $2, $3, 'Offer Snapshot', $4, '100.00')`,
    [order!.order_id, opts.restId, opts.offerId, opts.quantity],
  );
}

before(async () => {
  const { AppModule } = await import('../../src/app.module');
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  configureApplication(app, []);
  await app.init();
  db = app.get(DataSource);

  await db.runMigrations({ transaction: 'all' });
  await db.query(
    'TRUNCATE device_tokens, order_item_addons, order_items, orders, cart_item_addons, cart_items, carts, delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );

  // Customer for seeding historical offer orders
  const custEmail = `cust-${randomUUID()}@example.com`;
  const custReg = await api().post('/api/v1/auth/register').send({
    full_name: 'Offer Fan',
    email: custEmail,
    password: commonPassword,
    phone: '+201099990001',
  });
  assert.equal(custReg.status, 201);
  customerUserId = custReg.body.data.user_id as string;

  // 3 open active restaurants
  const restA = await createRestaurant({
    email: `rest-a-${randomUUID()}@example.com`,
    phone: '+201088880001',
    title: 'مطعم الشام',
    activationStatus: 'Active',
  });
  restAId = restA.restId;

  const restB = await createRestaurant({
    email: `rest-b-${randomUUID()}@example.com`,
    phone: '+201088880002',
    title: 'مطعم البرجر',
    activationStatus: 'Active',
  });
  restBId = restB.restId;

  const restC = await createRestaurant({
    email: `rest-c-${randomUUID()}@example.com`,
    phone: '+201088880003',
    title: 'مطعم المشويات',
    activationStatus: 'Active',
  });
  restCId = restC.restId;

  // Closed active restaurant
  const cairoFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const [cairoH = 0] = cairoFormatter.format(new Date()).split(':').map(Number);
  const closedStart = `${String((cairoH + 3) % 24).padStart(2, '0')}:00:00`;
  const closedEnd = `${String((cairoH + 4) % 24).padStart(2, '0')}:00:00`;
  const restClosed = await createRestaurant({
    email: `rest-closed-${randomUUID()}@example.com`,
    phone: '+201088880004',
    title: 'مطعم مغلق الآن',
    opensAt: closedStart,
    closesAt: closedEnd,
    activationStatus: 'Active',
  });
  closedRestId = restClosed.restId;

  // Pending restaurant (must be excluded)
  await createRestaurant({
    email: `rest-pending-${randomUUID()}@example.com`,
    phone: '+201088880005',
    title: 'مطعم قيد المراجعة',
    activationStatus: 'Pending',
  });

  // Restaurant A offers:
  // 1) Highly popular offer (12 recent Delivered units) + 25% discount
  offerAPopularId = await createOffer(restA.token, {
    title: 'عرض الشام الأكثر طلباً',
    initialPrice: '200.00',
    realPrice: '150.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '10 days', created_at = NOW() - INTERVAL '10 days', expires_at = NOW() + INTERVAL '15 days' WHERE offer_id = $1`,
    [offerAPopularId],
  );
  await seedOfferOrder({
    restId: restAId,
    offerId: offerAPopularId,
    status: 'Delivered',
    quantity: 12,
    daysAgo: 2,
  });

  // 2) Second offer from Rest A (score ~33.35 > Rest C's ~23.75 — must STILL defer to Rest B & C in round-1 diversity!)
  offerASecondId = await createOffer(restA.token, {
    title: 'عرض الشام الثاني القوي',
    initialPrice: '200.00',
    realPrice: '160.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '10 days', created_at = NOW() - INTERVAL '10 days', expires_at = NOW() + INTERVAL '15 days' WHERE offer_id = $1`,
    [offerASecondId],
  );
  await seedOfferOrder({
    restId: restAId,
    offerId: offerASecondId,
    status: 'Accepted',
    quantity: 3,
    daysAgo: 1,
  });

  // 3) Third offer from Rest A with ONLY Cancelled & Rejected orders (orders_count must stay 0!)
  offerACancelledOnlyId = await createOffer(restA.token, {
    title: 'عرض الشام بطلبات ملغية فقط',
    initialPrice: '100.00',
    realPrice: '90.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '14 days', created_at = NOW() - INTERVAL '14 days', expires_at = NOW() + INTERVAL '20 days' WHERE offer_id = $1`,
    [offerACancelledOnlyId],
  );
  await seedOfferOrder({
    restId: restAId,
    offerId: offerACancelledOnlyId,
    status: 'Cancelled',
    quantity: 20,
    daysAgo: 1,
  });
  await seedOfferOrder({
    restId: restAId,
    offerId: offerACancelledOnlyId,
    status: 'Rejected',
    quantity: 10,
    daysAgo: 1,
  });

  // Hidden offers on Rest A (inactive, expired, future — must NEVER appear)
  const inactiveOfferId = await createOffer(restA.token, {
    title: 'عرض متوقف',
    initialPrice: '200.00',
    realPrice: '100.00',
    isActive: false,
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '1 day' WHERE offer_id = $1`,
    [inactiveOfferId],
  );

  const expiredOfferId = await createOffer(restA.token, {
    title: 'عرض منتهي',
    initialPrice: '200.00',
    realPrice: '100.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '5 days', expires_at = NOW() - INTERVAL '1 hour' WHERE offer_id = $1`,
    [expiredOfferId],
  );

  // Future offer (starts_at stays +1 hour in future)
  await createOffer(restA.token, {
    title: 'عرض مستقبلي',
    initialPrice: '200.00',
    realPrice: '100.00',
  });

  // Restaurant B: brand-new high-discount cold-start offer (0 orders, 40% discount, brand new)
  offerBHighDiscountId = await createOffer(restB.token, {
    title: 'عرض برجر جديد بخصم كبير',
    initialPrice: '200.00',
    realPrice: '120.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '2 hours', created_at = NOW() - INTERVAL '2 hours', expires_at = NOW() + INTERVAL '14 days' WHERE offer_id = $1`,
    [offerBHighDiscountId],
  );

  // Restaurant C: ending-soon urgent offer (ends in 4 hours, 20% discount)
  offerCUrgentId = await createOffer(restC.token, {
    title: 'عرض مشويات ينتهي قريباً',
    initialPrice: '300.00',
    realPrice: '240.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '12 days', created_at = NOW() - INTERVAL '12 days', expires_at = NOW() + INTERVAL '4 hours' WHERE offer_id = $1`,
    [offerCUrgentId],
  );

  // Closed restaurant: super popular offer (must STILL appear AFTER all open restaurants!)
  offerClosedId = await createOffer(restClosed.token, {
    title: 'عرض مطعم مغلق مشهور',
    initialPrice: '200.00',
    realPrice: '100.00',
  });
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '1 day', created_at = NOW() - INTERVAL '1 day', expires_at = NOW() + INTERVAL '5 days' WHERE offer_id = $1`,
    [offerClosedId],
  );
  await seedOfferOrder({
    restId: closedRestId,
    offerId: offerClosedId,
    status: 'Delivered',
    quantity: 50,
    daysAgo: 1,
  });
});

after(async () => {
  await app.close();
});

test('public offers feed partial indexes exist after migration', async () => {
  const indexes = (await db.query(
    `SELECT indexname FROM pg_indexes WHERE indexname IN ('ix_order_items_offer_order', 'ix_offers_public_active_window')`,
  )) as Array<{ indexname: string }>;
  assert.equal(indexes.length, 2);
});

test('GET /api/v1/offers ranks open restaurants first with composite score and per-restaurant diversity', async () => {
  const res = await api()
    .get('/api/v1/offers')
    .query({ page: 1, per_page: 20 });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.meta, {
    page: 1,
    per_page: 20,
    total: 6,
    last_page: 1,
  });

  const items = res.body.data as Array<{
    offer_id: string;
    rest_id: string;
    is_open: boolean;
    discount_percentage: number;
    orders_count: number;
  }>;
  assert.equal(items.length, 6);

  // First 3 items MUST be round-1 diversity slots from 3 distinct open restaurants (Rest A, Rest B, Rest C)
  const firstThreeRestIds = new Set(items.slice(0, 3).map((i) => i.rest_id));
  assert.deepEqual(firstThreeRestIds, new Set([restAId, restBId, restCId]));
  assert.ok(items.slice(0, 3).every((i) => i.is_open === true));

  // Rest A's popular offer (#1 in Rest A) takes overall #1
  assert.equal(items[0]!.offer_id, offerAPopularId);
  assert.equal(items[0]!.orders_count, 12);
  assert.equal(items[0]!.discount_percentage, 25);

  // Rest B's brand-new 40% cold-start offer & Rest C's urgent offer appear in round 1 ahead of Rest A's 2nd offer!
  const roundOneOfferIds = new Set(items.slice(0, 3).map((i) => i.offer_id));
  assert.ok(roundOneOfferIds.has(offerBHighDiscountId));
  assert.ok(roundOneOfferIds.has(offerCUrgentId));

  // Round 2 & 3 on open restaurants: Rest A's 2nd offer before Rest A's cancelled-only offer
  assert.equal(items[3]!.offer_id, offerASecondId);
  assert.equal(items[3]!.orders_count, 3);
  assert.equal(items[3]!.discount_percentage, 20);

  assert.equal(items[4]!.offer_id, offerACancelledOnlyId);
  // Cancelled & Rejected orders are strictly excluded from orders_count
  assert.equal(items[4]!.orders_count, 0);
  assert.equal(items[4]!.discount_percentage, 10);

  // Closed restaurant's offer ranks LAST despite 50 orders
  assert.equal(items[5]!.offer_id, offerClosedId);
  assert.equal(items[5]!.is_open, false);
  assert.equal(items[5]!.orders_count, 50);
  assert.equal(items[5]!.discount_percentage, 50);
});

test('GET /api/v1/offers supports pagination, limit/offset, trailing empty page total, and open_only filter', async () => {
  const page1 = await api()
    .get('/api/v1/offers')
    .query({ page: 1, per_page: 2 });
  assert.equal(page1.status, 200);
  assert.equal(page1.body.data.length, 2);
  assert.deepEqual(page1.body.meta, {
    page: 1,
    per_page: 2,
    total: 6,
    last_page: 3,
  });

  const page2 = await api()
    .get('/api/v1/offers')
    .query({ limit: 2, offset: 2 });
  assert.equal(page2.status, 200);
  assert.equal(page2.body.data.length, 2);
  assert.equal(page2.body.meta.page, 2);
  assert.notEqual(page2.body.data[0].offer_id, page1.body.data[0].offer_id);

  // Out-of-range page still returns accurate meta.total and meta.last_page
  const emptyPage = await api()
    .get('/api/v1/offers')
    .query({ page: 9, per_page: 2 });
  assert.equal(emptyPage.status, 200);
  assert.deepEqual(emptyPage.body.data, []);
  assert.deepEqual(emptyPage.body.meta, {
    page: 9,
    per_page: 2,
    total: 6,
    last_page: 3,
  });

  // open_only=true excludes closed restaurant
  const openOnly = await api()
    .get('/api/v1/offers')
    .query({ open_only: 'true' });
  assert.equal(openOnly.status, 200);
  assert.equal(openOnly.body.meta.total, 5);
  assert.ok(
    openOnly.body.data.every((o: { is_open: boolean }) => o.is_open === true),
  );
});

test('GET /api/v1/offers rejects invalid pagination, bad open_only, and unsupported sort parameter', async () => {
  const badLimit = await api().get('/api/v1/offers').query({ per_page: 200 });
  assert.equal(badLimit.status, 422);
  assert.equal(badLimit.body.error.code, 'VALIDATION_ERROR');

  const badOpenOnly = await api()
    .get('/api/v1/offers')
    .query({ open_only: 'yes' });
  assert.equal(badOpenOnly.status, 422);

  // sort is intentionally deferred as a future feature and rejected by whitelist
  const unsupportedSort = await api()
    .get('/api/v1/offers')
    .query({ sort: 'popular' });
  assert.equal(unsupportedSort.status, 422);
});
