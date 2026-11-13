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
const customerEmail = `customer-${randomUUID()}@example.com`;
const restaurantAEmail = `rest-a-${randomUUID()}@example.com`;
const restaurantBEmail = `rest-b-${randomUUID()}@example.com`;

let customerToken: string;
let restaurantAToken: string;
let restaurantBToken: string;
let restaurantAId: string;
let restaurantBId: string;

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
  customerToken = await loginUser(customerEmail);

  // 2. Register & verify Restaurant A (Pending initially)
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
        opens_at: '09:00:00',
        closes_at: '23:00:00',
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

  // 3. Register & verify Restaurant B
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
  const restBRow = await db.query(
    `SELECT rest_id FROM restaurant_profiles rp JOIN users u ON u.user_id = rp.user_id WHERE u.email = $1`,
    [restaurantBEmail],
  );
  restaurantBId = restBRow[0].rest_id;
});

after(async () => {
  if (app) await app.close();
});

test('Feature 07 - Addons and Product Links Integration Tests', async (t) => {
  await t.test('Role access control and authentication', async () => {
    // Unauthenticated
    const unauthAddon = await api().get('/api/v1/restaurant/addons');
    assert.equal(unauthAddon.status, 401);

    const unauthLink = await api().get('/api/v1/restaurant/products/1/addons');
    assert.equal(unauthLink.status, 401);

    // Customer role forbidden
    const customerAddon = await api()
      .get('/api/v1/restaurant/addons')
      .set('Authorization', bearer(customerToken));
    assert.equal(customerAddon.status, 403);
    assert.equal(customerAddon.body.message, 'Restaurant access required.');
    assert.equal(customerAddon.body.error.code, 'FORBIDDEN');
  });

  await t.test(
    'Pending or Suspended restaurant blocked with 403 RESTAURANT_NOT_ACTIVE',
    async () => {
      // Restaurant A is currently Pending
      const listAddons = await api()
        .get('/api/v1/restaurant/addons')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(listAddons.status, 403);
      assert.equal(listAddons.body.error.code, 'RESTAURANT_NOT_ACTIVE');

      const createAddon = await api()
        .post('/api/v1/restaurant/addons')
        .set('Authorization', bearer(restaurantAToken))
        .send({ addon_name: 'Cheese', addon_price: '10.00' });
      assert.equal(createAddon.status, 403);
      assert.equal(createAddon.body.error.code, 'RESTAURANT_NOT_ACTIVE');

      const linkAddon = await api()
        .put('/api/v1/restaurant/products/1/addons/1')
        .set('Authorization', bearer(restaurantAToken))
        .send({ is_active: true });
      assert.equal(linkAddon.status, 403);
      assert.equal(linkAddon.body.error.code, 'RESTAURANT_NOT_ACTIVE');
    },
  );

  let addonA1Id: string;
  let addonA2Id: string;
  let addonB1Id: string;
  let prodA1Id: string;

  await t.test('Admin activates restaurants; Addon CRUD succeeds', async () => {
    // Activate Restaurant A and B
    await db.query(
      `UPDATE restaurant_profiles SET activation_status = 'Active' WHERE rest_id IN ($1, $2)`,
      [restaurantAId, restaurantBId],
    );

    // 1. Create Addon 1 for Restaurant A
    const addon1Res = await api()
      .post('/api/v1/restaurant/addons')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        addon_name: 'Extra Cheddar',
        addon_price: '15.00',
        is_active: true,
      });
    assert.equal(addon1Res.status, 201);
    assert.equal(addon1Res.body.success, true);
    assert.equal(addon1Res.body.message, 'Addon created.');
    assert.equal(addon1Res.body.data.addon_name, 'Extra Cheddar');
    assert.equal(addon1Res.body.data.addon_price, '15.00');
    assert.equal(addon1Res.body.data.is_active, true);
    assert.equal(addon1Res.body.data.rest_id, restaurantAId);
    addonA1Id = addon1Res.body.data.addon_id;

    // 2. Create Addon 2 for Restaurant A
    const addon2Res = await api()
      .post('/api/v1/restaurant/addons')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        addon_name: 'Pickles',
        addon_price: '5.00',
        is_active: true,
      });
    assert.equal(addon2Res.status, 201);
    addonA2Id = addon2Res.body.data.addon_id;

    // 3. Create Addon for Restaurant B
    const addonBRes = await api()
      .post('/api/v1/restaurant/addons')
      .set('Authorization', bearer(restaurantBToken))
      .send({
        addon_name: 'Mushrooms',
        addon_price: '20.00',
      });
    assert.equal(addonBRes.status, 201);
    addonB1Id = addonBRes.body.data.addon_id;

    // 4. Invalid price returns 422
    const badPrice = await api()
      .post('/api/v1/restaurant/addons')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        addon_name: 'Free Item',
        addon_price: '-5.00',
      });
    assert.equal(badPrice.status, 422);

    // 5. List addons for Restaurant A
    const listRes = await api()
      .get('/api/v1/restaurant/addons')
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data.length, 2);
    assert.equal(listRes.body.data[0].addon_id, addonA1Id);
    assert.equal(listRes.body.data[1].addon_id, addonA2Id);

    // 6. Update Addon 1
    const updateRes = await api()
      .patch(`/api/v1/restaurant/addons/${addonA1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({
        addon_name: 'Smoked Cheddar',
        addon_price: '18.50',
        is_active: false,
      });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.addon_name, 'Smoked Cheddar');
    assert.equal(updateRes.body.data.addon_price, '18.50');
    assert.equal(updateRes.body.data.is_active, false);

    // 7. Update unowned addon returns 404
    const unownedUpdate = await api()
      .patch(`/api/v1/restaurant/addons/${addonB1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ addon_name: 'Hijacked' });
    assert.equal(unownedUpdate.status, 404);

    // Reactivate Addon 1
    await api()
      .patch(`/api/v1/restaurant/addons/${addonA1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ is_active: true });
  });

  await t.test('Product Addon Link operations and verification', async () => {
    // First, create a category and a product for Restaurant A
    const catRes = await api()
      .post('/api/v1/restaurant/categories')
      .set('Authorization', bearer(restaurantAToken))
      .send({ cat_title: 'Burgers' });
    assert.equal(catRes.status, 201);
    const catId = catRes.body.data.cat_id;

    const prodRes = await api()
      .post('/api/v1/restaurant/products')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        cat_id: catId,
        prod_name: 'Classic Burger',
        price: '70.00',
      });
    assert.equal(prodRes.status, 201);
    prodA1Id = prodRes.body.data.prod_id;

    // 1. Initial product has empty addon links
    const emptyLinks = await api()
      .get(`/api/v1/restaurant/products/${prodA1Id}/addons`)
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(emptyLinks.status, 200);
    assert.deepEqual(emptyLinks.body.data, []);

    // 2. Link Addon 1 to Product 1 via PUT (returns 200)
    const link1Res = await api()
      .put(`/api/v1/restaurant/products/${prodA1Id}/addons/${addonA1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ is_active: true });
    assert.equal(link1Res.status, 200);
    assert.equal(link1Res.body.success, true);
    assert.equal(link1Res.body.data.prod_id, prodA1Id);
    assert.equal(link1Res.body.data.addon_id, addonA1Id);
    assert.equal(link1Res.body.data.is_active, true);
    assert.ok(link1Res.body.data.addon);
    assert.equal(link1Res.body.data.addon.addon_name, 'Smoked Cheddar');

    // 3. Link Addon 2 to Product 1
    const link2Res = await api()
      .put(`/api/v1/restaurant/products/${prodA1Id}/addons/${addonA2Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ is_active: true });
    assert.equal(link2Res.status, 200);

    // 4. Update existing link to inactive (returns 200)
    const disableLink = await api()
      .put(`/api/v1/restaurant/products/${prodA1Id}/addons/${addonA1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ is_active: false });
    assert.equal(disableLink.status, 200);
    assert.equal(disableLink.body.data.is_active, false);

    // 5. List product addon links includes both active and inactive
    const linksList = await api()
      .get(`/api/v1/restaurant/products/${prodA1Id}/addons`)
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(linksList.status, 200);
    assert.equal(linksList.body.data.length, 2);
    assert.equal(linksList.body.data[0].addon_id, addonA1Id);
    assert.equal(linksList.body.data[0].is_active, false);
    assert.equal(linksList.body.data[1].addon_id, addonA2Id);
    assert.equal(linksList.body.data[1].is_active, true);

    // 6. Link with unowned addon returns 404
    const badAddonLink = await api()
      .put(`/api/v1/restaurant/products/${prodA1Id}/addons/${addonB1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ is_active: true });
    assert.equal(badAddonLink.status, 404);

    // 7. Link with unowned product returns 404
    const badProdLink = await api()
      .put(`/api/v1/restaurant/products/${prodA1Id}/addons/${addonB1Id}`)
      .set('Authorization', bearer(restaurantBToken))
      .send({ is_active: true });
    assert.equal(badProdLink.status, 404);

    // 8. List addons of unowned product returns 404
    const unownedList = await api()
      .get(`/api/v1/restaurant/products/${prodA1Id}/addons`)
      .set('Authorization', bearer(restaurantBToken));
    assert.equal(unownedList.status, 404);
  });
});

test('concurrent PUT addon links are idempotent', async () => {
  const [product] = await db.query(
    'SELECT prod_id FROM products WHERE rest_id=$1 LIMIT 1',
    [restaurantAId],
  );
  const [addon] = await db.query(
    'INSERT INTO addons(rest_id,addon_name,addon_price) VALUES($1,$2,$3) RETURNING addon_id',
    [restaurantAId, 'Concurrent cheese', '0.29'],
  );
  const url = `/api/v1/restaurant/products/${product.prod_id}/addons/${addon.addon_id}`;
  const results = await Promise.all(
    [1, 2].map(() =>
      api()
        .put(url)
        .set('Authorization', bearer(restaurantAToken))
        .send({ is_active: true }),
    ),
  );
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
  );
});
