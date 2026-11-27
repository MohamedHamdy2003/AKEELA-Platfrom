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
let shawarmaRestId: string;
let pizzaRestId: string;
let closedRestId: string;

function api() {
  return request(app.getHttpServer());
}

async function createVerifiedRestaurant(opts: {
  email: string;
  phone: string;
  title: string;
  description: string;
  opensAt?: string;
  closesAt?: string;
  activationStatus?: 'Active' | 'Pending' | 'Suspended';
  isActive?: boolean;
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
        rest_description: opts.description,
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
  if (opts.activationStatus && opts.activationStatus !== 'Pending') {
    await db.query(
      `UPDATE restaurant_profiles SET activation_status = $1, is_active = $2 WHERE rest_id = $3`,
      [opts.activationStatus, opts.isActive ?? true, restId],
    );
  }
  const login = await api().post('/api/v1/auth/login').send({
    email: opts.email,
    password: commonPassword,
  });
  assert.equal(login.status, 200);
  return {
    restId,
    token: login.body.data.tokens.access_token as string,
  };
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

  // 1. Open active Shawarma & Grill restaurant (guaranteed open in Africa/Cairo)
  const rest1 = await createVerifiedRestaurant({
    email: `shawarma-${randomUUID()}@example.com`,
    phone: '+201011110011',
    title: 'أكيلة الشام للشاورما',
    description: 'أشهى شاورمة سوري ومشويّات على الفحم',
    opensAt: '00:00:00',
    closesAt: '23:59:59',
    activationStatus: 'Active',
  });
  shawarmaRestId = rest1.restId;

  const catShawarma = await api()
    .post('/api/v1/restaurant/categories')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({ cat_title: 'الشاورما السوري', is_active: true });
  assert.equal(catShawarma.status, 201);
  const catShawarmaId = catShawarma.body.data.cat_id as string;

  const catHidden = await api()
    .post('/api/v1/restaurant/categories')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({ cat_title: 'شاورما مخفية', is_active: false });
  assert.equal(catHidden.status, 201);
  const catHiddenId = catHidden.body.data.cat_id as string;

  const prod1 = await api()
    .post('/api/v1/restaurant/products')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({
      cat_id: catShawarmaId,
      prod_name: 'وجبة شاورما فراخ سوري',
      prod_description: 'دجاج متبل بالثومية',
      price: '125.00',
      is_active: true,
    });
  assert.equal(prod1.status, 201);

  const prodInactive = await api()
    .post('/api/v1/restaurant/products')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({
      cat_id: catShawarmaId,
      prod_name: 'شاورما غير متاحة',
      price: '99.00',
      is_active: false,
    });
  assert.equal(prodInactive.status, 201);

  const prodInInactiveCat = await api()
    .post('/api/v1/restaurant/products')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({
      cat_id: catHiddenId,
      prod_name: 'شاورما تصنيف متوقف',
      price: '80.00',
      is_active: true,
    });
  assert.equal(prodInInactiveCat.status, 201);

  const now = Date.now();
  const activeOffer = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({
      offer_title: 'عرض شاورما العائلة',
      offer_description: '4 ساندوتش شاورما وبطاطس',
      initial_price: '360.00',
      real_price: '299.00',
      is_active: true,
      starts_at: new Date(now + 3600_000).toISOString(),
      expires_at: new Date(now + 86400_000).toISOString(),
    });
  assert.equal(activeOffer.status, 201);
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '1 hour' WHERE offer_id = $1`,
    [activeOffer.body.data.offer_id],
  );

  // Expired offer (must NOT appear)
  const expiredOffer = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', `Bearer ${rest1.token}`)
    .send({
      offer_title: 'عرض شاورما منتهي',
      initial_price: '200.00',
      real_price: '150.00',
      is_active: true,
      starts_at: new Date(now + 3600_000).toISOString(),
      expires_at: new Date(now + 86400_000).toISOString(),
    });
  assert.equal(expiredOffer.status, 201);
  await db.query(
    `UPDATE offers SET starts_at = NOW() - INTERVAL '2 hours', expires_at = NOW() - INTERVAL '1 hour' WHERE offer_id = $1`,
    [expiredOffer.body.data.offer_id],
  );

  // 2. Active Pizza & Koshary restaurant (tests typo tolerance & multi-restaurant discovery)
  const rest2 = await createVerifiedRestaurant({
    email: `pizza-${randomUUID()}@example.com`,
    phone: '+201011110022',
    title: 'بيتزا نابولي وكشري البلد',
    description: 'بيتزا إيطالي وكشرى مصري أصلي',
    opensAt: '00:00:00',
    closesAt: '23:59:59',
    activationStatus: 'Active',
  });
  pizzaRestId = rest2.restId;

  const catPizza = await api()
    .post('/api/v1/restaurant/categories')
    .set('Authorization', `Bearer ${rest2.token}`)
    .send({ cat_title: 'بيتزا إيطالي', is_active: true });
  assert.equal(catPizza.status, 201);

  const prodPizza = await api()
    .post('/api/v1/restaurant/products')
    .set('Authorization', `Bearer ${rest2.token}`)
    .send({
      cat_id: catPizza.body.data.cat_id,
      prod_name: 'بيتزا مارجريتا شاورما',
      prod_description: 'بيتزا بالجبنة الموتزاريلا',
      price: '160.00',
      is_active: true,
    });
  assert.equal(prodPizza.status, 201);

  // 3. Active but currently CLOSED restaurant (compute a 1-minute window guaranteed to be outside current Cairo time)
  const cairoFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const [cairoH = 0] = cairoFormatter.format(new Date()).split(':').map(Number);
  const closedStart = `${String((cairoH + 3) % 24).padStart(2, '0')}:00:00`;
  const closedEnd = `${String((cairoH + 4) % 24).padStart(2, '0')}:00:00`;
  const rest3 = await createVerifiedRestaurant({
    email: `closed-${randomUUID()}@example.com`,
    phone: '+201011110033',
    title: 'مطعم شاورما الليل المغلق',
    description: 'شاورما فقط',
    opensAt: closedStart,
    closesAt: closedEnd,
    activationStatus: 'Active',
  });
  closedRestId = rest3.restId;

  // 4. Pending restaurant (must NEVER appear in public search)
  await createVerifiedRestaurant({
    email: `pending-${randomUUID()}@example.com`,
    phone: '+201011110044',
    title: 'شاورما قيد المراجعة',
    description: 'شاورما غير مفعلة',
    activationStatus: 'Pending',
  });
});

after(async () => {
  await app.close();
});

test('global search indexes and PostgreSQL normalize_search_text function are installed', async () => {
  const [fnRow] = (await db.query(
    `SELECT normalize_search_text('أكيلة شَاوَرْمَة كشرى') AS norm`,
  )) as Array<{ norm: string }>;
  assert.equal(fnRow!.norm, 'اكيله شاورمه كشري');

  const indexes = (await db.query(
    `SELECT indexname FROM pg_indexes WHERE indexname LIKE 'ix_search_%'`,
  )) as Array<{ indexname: string }>;
  assert.equal(indexes.length, 7);
});

test('GET /api/v1/search matches restaurants, products, offers, and categories with Arabic normalization and visibility filtering', async () => {
  const res = await api().get('/api/v1/search').query({ q: 'شاورما' });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);

  const data = res.body.data;
  assert.equal(data.query, 'شاورما');
  assert.equal(data.normalized_query, 'شاورما');
  assert.equal(data.type, 'all');

  // Pending restaurant is excluded; active Shawarma, Pizza (via product), and Closed Shawarma appear
  const restIds = data.restaurants.map((r: { rest_id: string }) => r.rest_id);
  assert.ok(restIds.includes(shawarmaRestId));
  assert.ok(restIds.includes(pizzaRestId));
  assert.ok(restIds.includes(closedRestId));
  assert.equal(data.restaurants.length, 3);
  assert.equal(data.counts.restaurants, 3);

  // Direct open restaurant with matching name+category+product+offer ranks first
  assert.equal(data.restaurants[0].rest_id, shawarmaRestId);
  assert.equal(data.restaurants[0].is_open, true);
  assert.deepEqual(data.restaurants[0].matched_in, [
    'name',
    'category',
    'product',
    'offer',
  ]);
  assert.equal(data.restaurants[0].matching_items_count, 2);

  // Products exclude inactive product & product inside inactive category
  assert.equal(data.counts.products, 2);
  const prodNames = data.products.map(
    (p: { prod_name: string }) => p.prod_name,
  );
  assert.ok(prodNames.includes('وجبة شاورما فراخ سوري'));
  assert.ok(prodNames.includes('بيتزا مارجريتا شاورما'));
  assert.ok(!prodNames.includes('شاورما غير متاحة'));
  assert.ok(!prodNames.includes('شاورما تصنيف متوقف'));

  // Offers exclude expired offer
  assert.equal(data.counts.offers, 1);
  assert.equal(data.offers[0].offer_title, 'عرض شاورما العائلة');
  assert.equal(data.offers[0].rest_id, shawarmaRestId);

  // Categories exclude inactive category
  assert.equal(data.counts.categories, 1);
  assert.equal(data.categories[0].cat_title, 'الشاورما السوري');
});

test('Arabic normalization, unordered multi-token queries, and pg_trgm typo tolerance work end-to-end', async () => {
  // Alif/taa marbuta/diacritics normalization: 'اكيله' matches 'أكيلة الشام للشاورما'
  const normRes = await api().get('/api/v1/search').query({ q: 'اكيله' });
  assert.equal(normRes.status, 200);
  assert.equal(normRes.body.data.restaurants[0].rest_id, shawarmaRestId);

  // Unordered multi-token: 'سوري شاورما' matches 'وجبة شاورما فراخ سوري'
  const multiRes = await api()
    .get('/api/v1/search')
    .query({ q: 'سوري شاورما', type: 'products' });
  assert.equal(multiRes.status, 200);
  assert.equal(multiRes.body.data.products.length, 1);
  assert.equal(
    multiRes.body.data.products[0].prod_name,
    'وجبة شاورما فراخ سوري',
  );
  assert.deepEqual(multiRes.body.data.restaurants, []);

  // Yaa / Alif maqsura normalization: 'كشري' matches 'كشرى' in description/title
  const kosharyRes = await api().get('/api/v1/search').query({ q: 'كشري' });
  assert.equal(kosharyRes.status, 200);
  assert.equal(kosharyRes.body.data.restaurants[0].rest_id, pizzaRestId);

  // Typo tolerance via pg_trgm word_similarity (<%): 'بتزا' matches 'بيتزا'
  const typoRes = await api().get('/api/v1/search').query({ q: 'بتزا' });
  assert.equal(typoRes.status, 200);
  assert.ok(
    typoRes.body.data.restaurants.some(
      (r: { rest_id: string }) => r.rest_id === pizzaRestId,
    ),
  );
  assert.ok(
    typoRes.body.data.products.some(
      (p: { prod_name: string }) => p.prod_name === 'بيتزا مارجريتا شاورما',
    ),
  );
});

test('open_only, rest_id, limit, and type filters work and preserve exact total counts', async () => {
  const openOnlyRes = await api()
    .get('/api/v1/search')
    .query({ q: 'شاورما', open_only: 'true' });
  assert.equal(openOnlyRes.status, 200);
  const openIds = openOnlyRes.body.data.restaurants.map(
    (r: { rest_id: string }) => r.rest_id,
  );
  assert.ok(!openIds.includes(closedRestId));
  assert.equal(openOnlyRes.body.data.counts.restaurants, 2);

  // Scoped to single restaurant menu (rest_id)
  const scopedRes = await api()
    .get('/api/v1/search')
    .query({ q: 'شاورما', rest_id: pizzaRestId });
  assert.equal(scopedRes.status, 200);
  assert.equal(scopedRes.body.data.counts.products, 1);
  assert.equal(scopedRes.body.data.products[0].rest_id, pizzaRestId);
  assert.equal(scopedRes.body.data.counts.offers, 0);

  // limit=1 truncates items while counts keeps total matches
  const limitedRes = await api()
    .get('/api/v1/search')
    .query({ q: 'شاورما', limit: 1 });
  assert.equal(limitedRes.status, 200);
  assert.equal(limitedRes.body.data.restaurants.length, 1);
  assert.equal(limitedRes.body.data.counts.restaurants, 3);
  assert.equal(limitedRes.body.data.products.length, 1);
  assert.equal(limitedRes.body.data.counts.products, 2);
});

test('GET /api/v1/search validates query parameters strictly', async () => {
  const missingQ = await api().get('/api/v1/search');
  assert.equal(missingQ.status, 422);
  assert.equal(missingQ.body.error.code, 'VALIDATION_ERROR');

  const emptyQ = await api().get('/api/v1/search').query({ q: '   ' });
  assert.equal(emptyQ.status, 422);

  const badType = await api()
    .get('/api/v1/search')
    .query({ q: 'شاورما', type: 'invalid' });
  assert.equal(badType.status, 422);

  const badLimit = await api()
    .get('/api/v1/search')
    .query({ q: 'شاورما', limit: 100 });
  assert.equal(badLimit.status, 422);

  const badRestId = await api()
    .get('/api/v1/search')
    .query({ q: 'شاورما', rest_id: 'abc' });
  assert.equal(badRestId.status, 422);
});
