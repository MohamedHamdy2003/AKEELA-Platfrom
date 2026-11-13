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

test('Features 05 & 06 - Categories and Products Integration Tests', async (t) => {
  await t.test('Role access control and authentication', async () => {
    // Unauthenticated
    const unauthCat = await api().get('/api/v1/restaurant/categories');
    assert.equal(unauthCat.status, 401);

    const unauthProd = await api().get('/api/v1/restaurant/products');
    assert.equal(unauthProd.status, 401);

    // Customer role forbidden
    const customerCat = await api()
      .get('/api/v1/restaurant/categories')
      .set('Authorization', bearer(customerToken));
    assert.equal(customerCat.status, 403);
    assert.equal(customerCat.body.message, 'Restaurant access required.');
    assert.equal(customerCat.body.error.code, 'FORBIDDEN');

    const customerProd = await api()
      .get('/api/v1/restaurant/products')
      .set('Authorization', bearer(customerToken));
    assert.equal(customerProd.status, 403);
    assert.equal(customerProd.body.message, 'Restaurant access required.');
  });

  await t.test(
    'Pending or Suspended restaurant blocked with 403 RESTAURANT_NOT_ACTIVE',
    async () => {
      // Restaurant A is currently Pending
      const listCat = await api()
        .get('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(listCat.status, 403);
      assert.equal(listCat.body.error.code, 'RESTAURANT_NOT_ACTIVE');

      const createCat = await api()
        .post('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken))
        .send({ cat_title: 'Appetizers' });
      assert.equal(createCat.status, 403);
      assert.equal(createCat.body.error.code, 'RESTAURANT_NOT_ACTIVE');

      const listProd = await api()
        .get('/api/v1/restaurant/products')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(listProd.status, 403);
      assert.equal(listProd.body.error.code, 'RESTAURANT_NOT_ACTIVE');

      const createProd = await api()
        .post('/api/v1/restaurant/products')
        .set('Authorization', bearer(restaurantAToken))
        .send({
          cat_id: '1',
          prod_name: 'Burger',
          price: '50.00',
        });
      assert.equal(createProd.status, 403);
      assert.equal(createProd.body.error.code, 'RESTAURANT_NOT_ACTIVE');
    },
  );

  let catA1Id: string;
  let catA2Id: string;
  let catB1Id: string;
  let prodA1Id: string;

  await t.test(
    'Admin activates restaurants; Category CRUD succeeds',
    async () => {
      // Activate Restaurant A and B
      await db.query(
        `UPDATE restaurant_profiles SET activation_status = 'Active' WHERE rest_id IN ($1, $2)`,
        [restaurantAId, restaurantBId],
      );

      // 1. Create Category 1 for Restaurant A
      const cat1Res = await api()
        .post('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken))
        .send({
          cat_title: 'Sandwiches',
          display_order: 1,
          is_active: true,
        });
      assert.equal(cat1Res.status, 201);
      assert.equal(cat1Res.body.success, true);
      assert.equal(cat1Res.body.message, 'Category created.');
      assert.equal(cat1Res.body.data.cat_title, 'Sandwiches');
      assert.equal(cat1Res.body.data.display_order, 1);
      assert.equal(cat1Res.body.data.is_active, true);
      assert.equal(cat1Res.body.data.rest_id, restaurantAId);
      catA1Id = cat1Res.body.data.cat_id;

      // 2. Duplicate category title in same restaurant returns 409
      const dupRes = await api()
        .post('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken))
        .send({ cat_title: '  sandwiches  ' });
      assert.equal(dupRes.status, 409);
      assert.equal(dupRes.body.error.code, 'CONFLICT');

      // 3. Same category title in different restaurant succeeds
      const catB1Res = await api()
        .post('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantBToken))
        .send({ cat_title: 'Sandwiches', display_order: 0 });
      assert.equal(catB1Res.status, 201);
      catB1Id = catB1Res.body.data.cat_id;
      assert.notEqual(catB1Id, catA1Id);

      // 4. Create Category 2 for Restaurant A
      const cat2Res = await api()
        .post('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken))
        .send({
          cat_title: 'Drinks',
          display_order: 2,
          is_active: true,
        });
      assert.equal(cat2Res.status, 201);
      catA2Id = cat2Res.body.data.cat_id;

      // 5. List categories for Restaurant A (ordered by display_order ASC)
      const listRes = await api()
        .get('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.data.length, 2);
      assert.equal(listRes.body.data[0].cat_id, catA1Id);
      assert.equal(listRes.body.data[1].cat_id, catA2Id);

      // 6. Update Category 1 (title, display_order, is_active)
      const updateRes = await api()
        .patch(`/api/v1/restaurant/categories/${catA1Id}`)
        .set('Authorization', bearer(restaurantAToken))
        .send({
          cat_title: 'Burgers & Sandwiches',
          display_order: 0,
          is_active: false,
        });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.data.cat_title, 'Burgers & Sandwiches');
      assert.equal(updateRes.body.data.display_order, 0);
      assert.equal(updateRes.body.data.is_active, false);

      // 7. Update to existing title in same restaurant returns 409
      const conflictUpdate = await api()
        .patch(`/api/v1/restaurant/categories/${catA1Id}`)
        .set('Authorization', bearer(restaurantAToken))
        .send({ cat_title: 'Drinks' });
      assert.equal(conflictUpdate.status, 409);

      // 8. Update non-existent or other restaurant's category returns 404
      const otherCatUpdate = await api()
        .patch(`/api/v1/restaurant/categories/${catB1Id}`)
        .set('Authorization', bearer(restaurantAToken))
        .send({ cat_title: 'Hacked' });
      assert.equal(otherCatUpdate.status, 404);

      // Reactivate Cat 1
      await api()
        .patch(`/api/v1/restaurant/categories/${catA1Id}`)
        .set('Authorization', bearer(restaurantAToken))
        .send({ is_active: true });
    },
  );

  await t.test('Product CRUD operations and category association', async () => {
    // 1. Create product in Restaurant A's Category 1
    const prod1Res = await api()
      .post('/api/v1/restaurant/products')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        cat_id: catA1Id,
        prod_name: 'Cheeseburger',
        prod_description: 'Beef patty with melted cheddar',
        prod_image_url: 'https://example.com/cheeseburger.jpg',
        price: '85.50',
        is_active: true,
      });
    assert.equal(prod1Res.status, 201);
    assert.equal(prod1Res.body.success, true);
    assert.equal(prod1Res.body.message, 'Product created.');
    assert.equal(prod1Res.body.data.prod_name, 'Cheeseburger');
    assert.equal(prod1Res.body.data.price, '85.50');
    assert.equal(prod1Res.body.data.cat_id, catA1Id);
    assert.equal(prod1Res.body.data.rest_id, restaurantAId);
    prodA1Id = prod1Res.body.data.prod_id;

    // 2. Create product with invalid category (from Restaurant B) returns 404
    const badCatRes = await api()
      .post('/api/v1/restaurant/products')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        cat_id: catB1Id,
        prod_name: 'Cross-restaurant Item',
        price: '50.00',
      });
    assert.equal(badCatRes.status, 404);

    // 3. Create product with invalid price format returns 422
    const badPriceRes = await api()
      .post('/api/v1/restaurant/products')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        cat_id: catA1Id,
        prod_name: 'Bad Price Item',
        price: '-10.00',
      });
    assert.equal(badPriceRes.status, 422);

    // 4. Create second product in Drinks category
    const prod2Res = await api()
      .post('/api/v1/restaurant/products')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        cat_id: catA2Id,
        prod_name: 'Fresh Orange Juice',
        price: '30.00',
      });
    assert.equal(prod2Res.status, 201);

    // 5. List all products for Restaurant A
    const listRes = await api()
      .get('/api/v1/restaurant/products')
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data.length, 2);

    // 6. List products filtered by cat_id
    const filteredRes = await api()
      .get(`/api/v1/restaurant/products?cat_id=${catA1Id}`)
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(filteredRes.status, 200);
    assert.equal(filteredRes.body.data.length, 1);
    assert.equal(filteredRes.body.data[0].prod_id, prodA1Id);

    // Filter with other restaurant's category returns 404
    const badFilter = await api()
      .get(`/api/v1/restaurant/products?cat_id=${catB1Id}`)
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(badFilter.status, 404);

    // 7. Read product details for editing
    const getRes = await api()
      .get(`/api/v1/restaurant/products/${prodA1Id}`)
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.data.prod_id, prodA1Id);
    assert.equal(getRes.body.data.prod_name, 'Cheeseburger');

    // Read details of unowned product returns 404
    const getUnowned = await api()
      .get(`/api/v1/restaurant/products/${prodA1Id}`)
      .set('Authorization', bearer(restaurantBToken));
    assert.equal(getUnowned.status, 404);

    // 8. Update product (price, description, is_active)
    const updateRes = await api()
      .patch(`/api/v1/restaurant/products/${prodA1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({
        price: '95.00',
        prod_description: 'Updated gourmet burger',
        is_active: false,
      });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.data.price, '95.00');
    assert.equal(
      updateRes.body.data.prod_description,
      'Updated gourmet burger',
    );
    assert.equal(updateRes.body.data.is_active, false);

    // 9. Update product to other restaurant's category returns 404
    const updateBadCat = await api()
      .patch(`/api/v1/restaurant/products/${prodA1Id}`)
      .set('Authorization', bearer(restaurantAToken))
      .send({ cat_id: catB1Id });
    assert.equal(updateBadCat.status, 404);

    // 10. Update product by unowned restaurant returns 404
    const updateUnowned = await api()
      .patch(`/api/v1/restaurant/products/${prodA1Id}`)
      .set('Authorization', bearer(restaurantBToken))
      .send({ prod_name: 'Hijack' });
    assert.equal(updateUnowned.status, 404);
  });
});

test('concurrent normalized category titles remain unique', async () => {
  const results = await Promise.all(
    ['Concurrent Title', 'concurrent title'].map((cat_title) =>
      api()
        .post('/api/v1/restaurant/categories')
        .set('Authorization', bearer(restaurantAToken))
        .send({ cat_title }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
});
