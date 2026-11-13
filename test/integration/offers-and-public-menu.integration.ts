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
const customerEmail = `customer-${randomUUID()}@example.com`;
const restaurantAEmail = `rest-a-${randomUUID()}@example.com`;
const restaurantBEmail = `rest-b-${randomUUID()}@example.com`;

let restaurantAToken: string;
let restaurantBToken: string;
let restaurantAId: string;

function api() {
  return request(app.getHttpServer());
}

function bearer(token: string) {
  return `Bearer ${token}`;
}

async function loginUser(email: string, pw = commonPassword) {
  const response = await api()
    .post('/api/v1/auth/login')
    .send({ email, password: pw });
  assert.equal(response.status, 200);
  return response.body.data.tokens.access_token as string;
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
    'TRUNCATE order_item_addons, order_items, orders, cart_item_addons, cart_items, carts, delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );

  // 1. Register & verify Customer
  await api().post('/api/v1/auth/register').send({
    full_name: 'Customer One',
    email: customerEmail,
    password: commonPassword,
    phone: '+201011110001',
  });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [customerEmail],
  );

  // 2. Register & verify Restaurant A (Pending → Active)
  await api()
    .post('/api/v1/auth/register/restaurant')
    .send({
      full_name: 'Owner A',
      email: restaurantAEmail,
      password: commonPassword,
      phone: '+201022220001',
      profile: {
        rest_title: 'Kitchen A',
        rest_description: 'Fast food and grills',
        rest_image_url_mobile: 'https://example.com/rest-a.jpg',
        rest_address: '10 Corniche Street, Ismailia',
        longitude: '32.2700000',
        latitude: '30.5900000',
        opens_at: '00:00:00',
        closes_at: '23:59:00',
      },
    });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [restaurantAEmail],
  );
  restaurantAToken = await loginUser(restaurantAEmail);
  const restARow = await db.query(
    `SELECT rest_id FROM restaurant_profiles rp JOIN users u ON u.user_id = rp.user_id WHERE u.email = $1`,
    [restaurantAEmail],
  );
  restaurantAId = restARow[0].rest_id;

  // Activate Restaurant A
  await db.query(
    `UPDATE restaurant_profiles SET activation_status = 'Active' WHERE rest_id = $1`,
    [restaurantAId],
  );
  // Refresh token after activation
  restaurantAToken = await loginUser(restaurantAEmail);

  // 3. Register & verify Restaurant B (stays Pending)
  await api()
    .post('/api/v1/auth/register/restaurant')
    .send({
      full_name: 'Owner B',
      email: restaurantBEmail,
      password: commonPassword,
      phone: '+201022220002',
      profile: {
        rest_title: 'Kitchen B',
        rest_description: 'Pizza and pasta',
        rest_image_url_mobile: 'https://example.com/rest-b.jpg',
        rest_address: '25 Sultan Hussein, Ismailia',
        longitude: '32.2800000',
        latitude: '30.6000000',
        opens_at: '10:00:00',
        closes_at: '02:00:00',
      },
    });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [restaurantBEmail],
  );
  restaurantBToken = await loginUser(restaurantBEmail);
});

after(async () => {
  await app.close();
});

// ===========================
// Feature 08: Offers
// ===========================

test('08-01: list offers — empty list when restaurant has no offers', async () => {
  const res = await api()
    .get('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken));
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data, []);
  assert.equal(res.body.meta.total, 0);
});

test('08-02: create offer — success', async () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const farFuture = new Date(Date.now() + 7_200_000).toISOString();
  const res = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'Lunch Special',
      offer_description: 'A great lunch deal',
      initial_price: '150.00',
      real_price: '120.00',
      offer_image_url: null,
      is_active: true,
      starts_at: future,
      expires_at: farFuture,
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.offer_title, 'Lunch Special');
  assert.equal(res.body.data.real_price, '120.00');
  assert.equal(res.body.data.initial_price, '150.00');
  assert.equal(res.body.data.rest_id, restaurantAId);
  assert.ok(res.body.data.offer_id);
});

test('08-03: create offer — real_price > initial_price returns 422', async () => {
  const future = new Date(Date.now() + 3600_000).toISOString();
  const farFuture = new Date(Date.now() + 7_200_000).toISOString();
  const res = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'Bad Offer',
      initial_price: '100.00',
      real_price: '150.00',
      starts_at: future,
      expires_at: farFuture,
    });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('08-04: create offer — expires_at before starts_at returns 422', async () => {
  const future = new Date(Date.now() + 7_200_000).toISOString();
  const earlier = new Date(Date.now() + 3_600_000).toISOString();
  const res = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'Bad Dates',
      initial_price: '100.00',
      real_price: '80.00',
      starts_at: future,
      expires_at: earlier,
    });
  assert.equal(res.status, 422);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
});

test('08-05: list offers — returns created offer', async () => {
  const res = await api()
    .get('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken));
  assert.equal(res.status, 200);
  assert.ok(res.body.meta.total >= 1);
});

test('08-06: update offer — patch title and price', async () => {
  // Create a fresh offer first
  const future = new Date(Date.now() + 3600_000).toISOString();
  const farFuture = new Date(Date.now() + 7_200_000).toISOString();
  const created = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'To Update',
      initial_price: '200.00',
      real_price: '180.00',
      starts_at: future,
      expires_at: farFuture,
    });
  assert.equal(created.status, 201);
  const offerId = created.body.data.offer_id;

  const res = await api()
    .patch(`/api/v1/restaurant/offers/${offerId}`)
    .set('Authorization', bearer(restaurantAToken))
    .send({ offer_title: 'Updated Offer', real_price: '170.00' });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.offer_title, 'Updated Offer');
  assert.equal(res.body.data.real_price, '170.00');
});

test('08-07: update offer — not found for another restaurant', async () => {
  // Create offer under Restaurant A
  const future = new Date(Date.now() + 3600_000).toISOString();
  const farFuture = new Date(Date.now() + 7_200_000).toISOString();
  const created = await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'Exclusive',
      initial_price: '100.00',
      real_price: '90.00',
      starts_at: future,
      expires_at: farFuture,
    });
  assert.equal(created.status, 201);
  const offerId = created.body.data.offer_id;

  // Restaurant B cannot update Restaurant A's offer
  // But B is Pending, so it gets RESTAURANT_NOT_ACTIVE first
  const res = await api()
    .patch(`/api/v1/restaurant/offers/${offerId}`)
    .set('Authorization', bearer(restaurantBToken))
    .send({ offer_title: 'Stolen' });
  assert.equal(res.status, 403);
});

test('08-08: list offers — Pending restaurant gets 403', async () => {
  const res = await api()
    .get('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantBToken));
  assert.equal(res.status, 403);
  assert.equal(res.body.error.code, 'RESTAURANT_NOT_ACTIVE');
});

// ===========================
// Feature 09: Public Restaurant Menu
// ===========================

test('09-01: GET /restaurants — returns active restaurants', async () => {
  const res = await api().get('/api/v1/restaurants');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  // Restaurant A is Active, B is Pending — only A should appear
  const ids = res.body.data.map((r: { rest_id: string }) => r.rest_id);
  assert.ok(ids.includes(restaurantAId));
  // Each record has is_open field
  assert.ok(typeof res.body.data[0].is_open === 'boolean');
});

test('09-02: GET /restaurants/:rest_id — returns public profile for active restaurant', async () => {
  const res = await api().get(`/api/v1/restaurants/${restaurantAId}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.rest_id, restaurantAId);
  assert.equal(res.body.data.rest_title, 'Kitchen A');
  assert.ok('is_open' in res.body.data);
});

test('09-03: GET /restaurants/:rest_id — 404 for Pending restaurant', async () => {
  const restBRow = await db.query(
    `SELECT rest_id FROM restaurant_profiles rp JOIN users u ON u.user_id = rp.user_id WHERE u.email = $1`,
    [restaurantBEmail],
  );
  const restBId = restBRow[0].rest_id;
  const res = await api().get(`/api/v1/restaurants/${restBId}`);
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('09-04: GET /restaurants/:rest_id/categories — returns active categories', async () => {
  // Create a category under Restaurant A
  await api()
    .post('/api/v1/restaurant/categories')
    .set('Authorization', bearer(restaurantAToken))
    .send({ cat_title: 'Mains', display_order: 0, is_active: true });

  const res = await api().get(
    `/api/v1/restaurants/${restaurantAId}/categories`,
  );
  assert.equal(res.status, 200);
  assert.ok(res.body.meta.total >= 1);
  // Each entry has only public fields
  const cat = res.body.data[0];
  assert.ok(cat.cat_id);
  assert.ok(cat.cat_title);
  assert.ok('display_order' in cat);
  assert.ok(!('is_active' in cat), 'is_active must not be in public category');
});

test('09-05: GET /restaurants/:rest_id/products — returns active products', async () => {
  // Get a category ID
  const catRes = await api().get(
    `/api/v1/restaurants/${restaurantAId}/categories`,
  );
  const catId = catRes.body.data[0].cat_id;

  // Create a product
  await api()
    .post('/api/v1/restaurant/products')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      cat_id: catId,
      prod_name: 'Grilled Chicken',
      price: '75.00',
      is_active: true,
    });

  const res = await api().get(`/api/v1/restaurants/${restaurantAId}/products`);
  assert.equal(res.status, 200);
  assert.ok(res.body.meta.total >= 1);
  const prod = res.body.data[0];
  assert.ok(prod.prod_id);
  assert.ok(prod.prod_name);
  assert.ok(prod.price);
  assert.ok(!('is_active' in prod), 'is_active must not be in public product');
});

test('09-06: GET /restaurants/:rest_id/products/:prod_id — returns product with active addons', async () => {
  // Get product id from previous step
  const productsRes = await api().get(
    `/api/v1/restaurants/${restaurantAId}/products`,
  );
  const prodId = productsRes.body.data[0].prod_id;

  const res = await api().get(
    `/api/v1/restaurants/${restaurantAId}/products/${prodId}`,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.data.prod_id, prodId);
  assert.ok(Array.isArray(res.body.data.addons));
});

test('09-07: GET /restaurants/:rest_id/offers — only returns active offers within sale window', async () => {
  // Create an offer that is currently active (started in the past, expires in the future)
  const past = new Date(Date.now() - 3600_000).toISOString();
  const future = new Date(Date.now() + 3600_000).toISOString();
  await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'Live Offer',
      initial_price: '100.00',
      real_price: '80.00',
      is_active: true,
      starts_at: past,
      expires_at: future,
    });

  // Create a future offer (not yet started)
  const farFuture = new Date(Date.now() + 7_200_000).toISOString();
  const evenFarther = new Date(Date.now() + 10_800_000).toISOString();
  await api()
    .post('/api/v1/restaurant/offers')
    .set('Authorization', bearer(restaurantAToken))
    .send({
      offer_title: 'Future Offer',
      initial_price: '100.00',
      real_price: '80.00',
      is_active: true,
      starts_at: farFuture,
      expires_at: evenFarther,
    });

  const res = await api().get(`/api/v1/restaurants/${restaurantAId}/offers`);
  assert.equal(res.status, 200);
  const titles = res.body.data.map(
    (o: { offer_title: string }) => o.offer_title,
  );
  assert.ok(titles.includes('Live Offer'));
  assert.ok(!titles.includes('Future Offer'));
  // No is_active in public offer response
  assert.ok(!('is_active' in res.body.data[0]));
});

test('09-08: GET /restaurants/:rest_id/offers/:offer_id — returns active offer', async () => {
  const offersRes = await api().get(
    `/api/v1/restaurants/${restaurantAId}/offers`,
  );
  const offerId = offersRes.body.data[0].offer_id;

  const res = await api().get(
    `/api/v1/restaurants/${restaurantAId}/offers/${offerId}`,
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.data.offer_id, offerId);
});

test('09-09: GET /restaurants/:rest_id/offers/:offer_id — 404 for future offer', async () => {
  // Get a future (not live) offer id directly from db
  const rows = await db.query(
    `SELECT offer_id FROM offers WHERE rest_id = $1 AND starts_at > NOW()`,
    [restaurantAId],
  );
  if (rows.length === 0) return; // no future offer seeded

  const offerId = rows[0].offer_id;
  const res = await api().get(
    `/api/v1/restaurants/${restaurantAId}/offers/${offerId}`,
  );
  assert.equal(res.status, 404);
});

test('09-10: public routes require no auth token', async () => {
  // Verify no Authorization header required
  const res = await api().get('/api/v1/restaurants');
  assert.equal(res.status, 200);
});

test('public menu hides inactive owners and inactive categories', async () => {
  const [restaurant] = await db.query(
    'SELECT rest_id,user_id FROM restaurant_profiles WHERE rest_id=$1',
    [restaurantAId],
  );
  await db.query(
    "UPDATE restaurant_profiles SET activation_status='Active',is_active=true WHERE rest_id=$1",
    [restaurantAId],
  );
  await db.query(
    'UPDATE users SET is_active=true,email_verified_at=now() WHERE user_id=$1',
    [restaurant.user_id],
  );
  const [category] = await db.query(
    'INSERT INTO categories(rest_id,cat_title,is_active) VALUES($1,$2,false) RETURNING cat_id',
    [restaurantAId, 'Hidden ' + randomUUID()],
  );
  const [product] = await db.query(
    'INSERT INTO products(rest_id,cat_id,prod_name,price) VALUES($1,$2,$3,$4) RETURNING prod_id',
    [restaurantAId, category.cat_id, 'Hidden product', '0.29'],
  );
  const products = await api()
    .get(`/api/v1/restaurants/${restaurantAId}/products`)
    .expect(200);
  assert.ok(
    !products.body.data.some(
      (p: { prod_id: string }) => p.prod_id === product.prod_id,
    ),
  );
  await api()
    .get(`/api/v1/restaurants/${restaurantAId}/products/${product.prod_id}`)
    .expect(404);
  await db.query('UPDATE users SET is_active=false WHERE user_id=$1', [
    restaurant.user_id,
  ]);
  await api().get(`/api/v1/restaurants/${restaurantAId}`).expect(404);
  const all = await api().get('/api/v1/restaurants').expect(200);
  assert.ok(
    !all.body.data.some(
      (p: { rest_id: string }) => p.rest_id === restaurantAId,
    ),
  );
});
