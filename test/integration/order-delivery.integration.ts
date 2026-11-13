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

import { AuthCryptoService } from '../../src/modules/auth/auth-crypto.service';
import { ConfigService } from '@nestjs/config';
let app: INestApplication;
let db: DataSource;
let config: ConfigService;
const tokens: string[] = [];
const users: string[] = [];
const rests: string[] = [];
const products: string[] = [];
const companies: string[] = [];
const drivers: string[] = [];
const api = () => request(app.getHttpServer());
const auth = (index: number) => `Bearer ${tokens[index]}`;
// 0 Customer, 1 Restaurant A, 2 Restaurant B, 3 Company A, 4 Company B, 5 Admin.
async function newOrder(index = 0) {
  await api()
    .post('/api/v1/customer/cart/items')
    .set('Authorization', auth(0))
    .send({
      rest_id: rests[index],
      prod_id: products[index],
      quantity: 1,
      addons: [],
    })
    .expect(201);
  const order = await api()
    .post('/api/v1/customer/orders')
    .set('Authorization', auth(0))
    .send({
      delivery_address: {
        address_line: 'Customer Street',
        longitude: '32.28',
        latitude: '30.60',
      },
    })
    .expect(201);
  return order.body.data.order_id as string;
}
const accept = (id: string) =>
  api()
    .post(`/api/v1/restaurant/orders/${id}/accept`)
    .set('Authorization', auth(1));
const assign = (id: string, driver = drivers[0]) =>
  api()
    .put(`/api/v1/delivery-company/orders/${id}/driver`)
    .set('Authorization', auth(3))
    .send({ driver_id: driver });
const pickup = (id: string) =>
  api()
    .post(`/api/v1/delivery-company/orders/${id}/pickup`)
    .set('Authorization', auth(3));
const deliver = (id: string) =>
  api()
    .post(`/api/v1/delivery-company/orders/${id}/deliver`)
    .set('Authorization', auth(3));
before(async () => {
  const { AppModule } = await import('../../src/app.module');
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  configureApplication(app, []);
  await app.init();
  db = app.get(DataSource);
  config = app.get(ConfigService);
  await db.runMigrations({ transaction: 'all' });
  await db.query(
    'TRUNCATE order_item_addons,order_items,orders,cart_item_addons,cart_items,carts,delivery_drivers,offers,product_addons,addons,products,categories,customer_addresses,auth_sessions,auth_challenges,admin_profiles,delivery_company_profiles,restaurant_profiles,customer_profiles,users RESTART IDENTITY',
  );
  const hash = await app.get(AuthCryptoService).hashPassword('TestPassword123');
  for (const [i, role] of [
    'Customer',
    'Restaurant',
    'Restaurant',
    'Delivery_Company',
    'Delivery_Company',
    'Admin',
  ].entries()) {
    const email = `operations-${i}-${randomUUID()}@example.com`;
    const [user] = await db.query(
      'INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING user_id',
      ['Test User', email, hash, `+20111111111${i}`, role],
    );
    users.push(user.user_id);
    if (role === 'Customer')
      await db.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [
        user.user_id,
      ]);
    if (role === 'Admin')
      await db.query('INSERT INTO admin_profiles(user_id) VALUES($1)', [
        user.user_id,
      ]);
    if (role === 'Restaurant') {
      const [rest] = await db.query(
        "INSERT INTO restaurant_profiles(user_id,rest_title,rest_address,longitude,latitude,opens_at,closes_at,activation_status) VALUES($1,'Kitchen','Pickup Street',32.28,30.60,'00:00:00','23:59:59','Active') RETURNING rest_id",
        [user.user_id],
      );
      rests.push(rest.rest_id);
      const [cat] = await db.query(
        "INSERT INTO categories(rest_id,cat_title) VALUES($1,'Food') RETURNING cat_id",
        [rest.rest_id],
      );
      const [product] = await db.query(
        "INSERT INTO products(rest_id,cat_id,prod_name,price) VALUES($1,$2,'Burger','25.00') RETURNING prod_id",
        [rest.rest_id, cat.cat_id],
      );
      products.push(product.prod_id);
    }
    if (role === 'Delivery_Company') {
      const [company] = await db.query(
        "INSERT INTO delivery_company_profiles(user_id,company_name,company_phone,company_address) VALUES($1,'Company','+201111111199','Company Street') RETURNING company_id",
        [user.user_id],
      );
      companies.push(company.company_id);
    }
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123' })
      .expect(200);
    tokens.push(login.body.data.tokens.access_token);
  }
  for (const company of [companies[0], companies[0], companies[1]]) {
    const [driver] = await db.query(
      "INSERT INTO delivery_drivers(company_id,driver_name,driver_phone) VALUES($1,'Driver','+201111111188') RETURNING driver_id",
      [company],
    );
    drivers.push(driver.driver_id);
  }
  config.set('DEFAULT_DELIVERY_COMPANY_ID', companies[0]);
});
after(async () => {
  if (app) await app.close();
});
test('Features 13-14: restaurant acceptance and assigned delivery', async (t) => {
  await t.test(
    'roles, pagination and restaurant/company ownership',
    async () => {
      const id = await newOrder();
      await api().get('/api/v1/restaurant/orders').expect(401);
      await api()
        .get('/api/v1/admin/orders')
        .set('Authorization', auth(1))
        .expect(403);
      await api()
        .get('/api/v1/restaurant/orders')
        .set('Authorization', auth(0))
        .expect(403);
      await api()
        .get(`/api/v1/restaurant/orders/${id}`)
        .set('Authorization', auth(2))
        .expect(404);
      await api()
        .get(`/api/v1/delivery-company/orders/${id}`)
        .set('Authorization', auth(3))
        .expect(404);
      const list = await api()
        .get('/api/v1/restaurant/orders?status=Pending&per_page=1')
        .set('Authorization', auth(1))
        .expect(200);
      assert.equal(list.body.meta.total, 1);
      await api()
        .get(`/api/v1/admin/orders/${id}`)
        .set('Authorization', auth(5))
        .expect(200);
      await api()
        .post(`/api/v1/admin/orders/${id}/fail`)
        .set('Authorization', auth(5))
        .expect(409);
      await api()
        .get('/api/v1/restaurant/orders?date_from=2026-02-30')
        .set('Authorization', auth(1))
        .expect(422);
      await api()
        .get('/api/v1/admin/orders?date_from=2026-12-01&date_to=2026-01-01')
        .set('Authorization', auth(5))
        .expect(422);
    },
  );
  await t.test(
    'unconfigured/inactive/unverified company leaves order Pending',
    async () => {
      const id = await newOrder();
      for (const value of [null, '999999']) {
        config.set('DEFAULT_DELIVERY_COMPANY_ID', value);
        await accept(id).expect(409);
      }
      config.set('DEFAULT_DELIVERY_COMPANY_ID', companies[0]);
      await db.query(
        'UPDATE delivery_company_profiles SET is_active=false WHERE company_id=$1',
        [companies[0]],
      );
      await accept(id).expect(409);
      await db.query(
        'UPDATE delivery_company_profiles SET is_active=true WHERE company_id=$1',
        [companies[0]],
      );
      await db.query('UPDATE users SET is_active=false WHERE user_id=$1', [
        users[3],
      ]);
      await accept(id).expect(409);
      await db.query(
        'UPDATE users SET is_active=true,email_verified_at=NULL WHERE user_id=$1',
        [users[3]],
      );
      await accept(id).expect(409);
      assert.equal(
        (
          await db.query(
            'SELECT status,company_id FROM orders WHERE order_id=$1',
            [id],
          )
        )[0].status,
        'Pending',
      );
      await db.query(
        'UPDATE users SET email_verified_at=now() WHERE user_id=$1',
        [users[3]],
      );
      const accepted = await accept(id).expect(200);
      assert.equal(accepted.body.data.company_id, companies[0]);
      assert.equal(accepted.body.data.driver_id, null);
      config.set('DEFAULT_DELIVERY_COMPANY_ID', companies[1]);
      const retry = await accept(id).expect(200);
      assert.equal(retry.body.data.company_id, companies[0]);
      config.set('DEFAULT_DELIVERY_COMPANY_ID', companies[0]);
      await api()
        .post(`/api/v1/restaurant/orders/${id}/reject`)
        .set('Authorization', auth(1))
        .expect(409);
    },
  );
  await t.test(
    'driver ownership, active driver, transitions and immutable final states',
    async () => {
      const id = await newOrder();
      await accept(id).expect(200);
      await api()
        .get(`/api/v1/delivery-company/orders/${id}`)
        .set('Authorization', auth(4))
        .expect(404);
      await pickup(id).expect(409);
      await assign(id, drivers[2]).expect(404);
      await db.query(
        'UPDATE delivery_drivers SET is_active=false WHERE driver_id=$1',
        [drivers[0]],
      );
      await assign(id).expect(409);
      await db.query(
        'UPDATE delivery_drivers SET is_active=true WHERE driver_id=$1',
        [drivers[0]],
      );
      await assign(id).expect(200);
      await assign(id, drivers[1]).expect(200);
      await deliver(id).expect(409);
      await api()
        .post(`/api/v1/delivery-company/orders/${id}/pickup`)
        .set('Authorization', auth(3))
        .send({ status: 'Delivered' })
        .expect(422);
      await pickup(id).expect(200);
      await assign(id).expect(409);
      await deliver(id).expect(200);
      await deliver(id).expect(409);
      await accept(id).expect(409);
      await api()
        .post(`/api/v1/admin/orders/${id}/fail`)
        .set('Authorization', auth(5))
        .expect(409);
      const view = await api()
        .get(`/api/v1/delivery-company/orders/${id}`)
        .set('Authorization', auth(3))
        .expect(200);
      assert.equal(view.body.data.pickup.rest_address, 'Pickup Street');
      assert.equal(view.body.data.customer_address, 'Customer Street');
      assert.equal(view.body.data.total_price, '55.00');
    },
  );
  await t.test(
    'restaurant suspension blocks order APIs but assigned delivery can finish',
    async () => {
      const id = await newOrder();
      await accept(id).expect(200);
      await assign(id).expect(200);
      await db.query(
        "UPDATE restaurant_profiles SET activation_status='Suspended' WHERE rest_id=$1",
        [rests[0]],
      );
      await api()
        .get('/api/v1/restaurant/orders')
        .set('Authorization', auth(1))
        .expect(403);
      await accept(id).expect(403);
      await pickup(id).expect(200);
      await deliver(id).expect(200);
      await db.query(
        "UPDATE restaurant_profiles SET activation_status='Active' WHERE rest_id=$1",
        [rests[0]],
      );
    },
  );
  await t.test(
    'single company cannot be disabled through either management API',
    async () => {
      const email = `inactive-company-${randomUUID()}@example.com`;
      await api()
        .post('/api/v1/admin/users')
        .set('Authorization', auth(5))
        .send({
          full_name: 'Owner',
          email,
          password: 'TestPassword123',
          phone: '+201555555555',
          role: 'Delivery_Company',
          profile: {
            company_name: 'Company',
            company_phone: '+201555555555',
            company_address: 'Street',
            is_active: false,
          },
        })
        .expect(409);
      assert.equal(
        (
          await db.query('SELECT count(*) FROM users WHERE email=$1', [email])
        )[0].count,
        '0',
      );
      await api()
        .patch('/api/v1/delivery-company/profile')
        .set('Authorization', auth(3))
        .send({ is_active: false })
        .expect(409);
      await api()
        .patch(`/api/v1/admin/users/${users[3]}/activity`)
        .set('Authorization', auth(5))
        .send({ is_active: false })
        .expect(409);
    },
  );
  await t.test(
    'stopping new sales does not block existing restaurant orders',
    async () => {
      const id = await newOrder();
      await db.query(
        'UPDATE restaurant_profiles SET is_active=false WHERE rest_id=$1',
        [rests[0]],
      );
      try {
        await api()
          .get(`/api/v1/restaurant/orders/${id}`)
          .set('Authorization', auth(1))
          .expect(200);
        await accept(id).expect(200);
        await api()
          .post('/api/v1/customer/cart/items')
          .set('Authorization', auth(0))
          .send({ rest_id: rests[0], prod_id: products[0], quantity: 1 })
          .expect(409);
      } finally {
        await db.query(
          'UPDATE restaurant_profiles SET is_active=true WHERE rest_id=$1',
          [rests[0]],
        );
      }
    },
  );
  await t.test(
    'concurrent driver/pickup and deliver/fail actions preserve valid state',
    async () => {
      const id = await newOrder();
      await accept(id).expect(200);
      await assign(id).expect(200);
      const results = await Promise.all([assign(id, drivers[1]), pickup(id)]);
      assert.equal(results[1]!.status, 200);
      assert.ok([200, 409].includes(results[0]!.status));
      const [order] = await db.query(
        'SELECT status,driver_id FROM orders WHERE order_id=$1',
        [id],
      );
      assert.equal(order.status, 'Picked_Up');
      assert.equal(
        order.driver_id,
        results[0]!.status === 200 ? drivers[1] : drivers[0],
      );
      const finals = await Promise.all([
        deliver(id),
        api()
          .post(`/api/v1/admin/orders/${id}/fail`)
          .set('Authorization', auth(5)),
      ]);
      assert.deepEqual(finals.map((r) => r.status).sort(), [200, 409]);
    },
  );
  await t.test(
    'disabled drivers must be reactivated before pickup or delivery',
    async () => {
      const id = await newOrder();
      await accept(id).expect(200);
      await assign(id).expect(200);
      await db.query(
        'UPDATE delivery_drivers SET is_active=false WHERE driver_id=$1',
        [drivers[0]],
      );
      await pickup(id).expect(409);
      await db.query(
        'UPDATE delivery_drivers SET is_active=true WHERE driver_id=$1',
        [drivers[0]],
      );
      await pickup(id).expect(200);
      await db.query(
        'UPDATE delivery_drivers SET is_active=false WHERE driver_id=$1',
        [drivers[0]],
      );
      await deliver(id).expect(409);
      await db.query(
        'UPDATE delivery_drivers SET is_active=true WHERE driver_id=$1',
        [drivers[0]],
      );
      await deliver(id).expect(200);
    },
  );
  await t.test('Admin failure at Accepted or Picked_Up is final', async () => {
    for (const picked of [false, true]) {
      const id = await newOrder();
      await accept(id).expect(200);
      await assign(id).expect(200);
      if (picked) await pickup(id).expect(200);
      await api()
        .post(`/api/v1/admin/orders/${id}/fail`)
        .set('Authorization', auth(5))
        .expect(200);
      await deliver(id).expect(409);
      await pickup(id).expect(409);
    }
  });
  await t.test(
    'concurrent accept/cancel and accept/reject have only one winning transition',
    async () => {
      const id = await newOrder();
      const results = await Promise.all([
        accept(id),
        api()
          .post(`/api/v1/customer/orders/${id}/cancel`)
          .set('Authorization', auth(0)),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      const other = await newOrder();
      const decision = await Promise.all([
        accept(other),
        api()
          .post(`/api/v1/restaurant/orders/${other}/reject`)
          .set('Authorization', auth(1)),
      ]);
      assert.deepEqual(decision.map((r) => r.status).sort(), [200, 409]);
      const same = await newOrder();
      const retries = await Promise.all([accept(same), accept(same)]);
      assert.deepEqual(
        retries.map((r) => r.status),
        [200, 200],
      );
    },
  );
  await t.test(
    'date filters include entire Cairo day and history reaches the customer',
    async () => {
      const first = await newOrder();
      const second = await newOrder();
      await db.query(
        "UPDATE orders SET created_at='2026-01-01T21:59:59Z' WHERE order_id=$1",
        [first],
      );
      await db.query(
        "UPDATE orders SET created_at='2026-01-01T22:00:00Z' WHERE order_id=$1",
        [second],
      );
      const list = await api()
        .get(
          '/api/v1/restaurant/orders?date_from=2026-01-01&date_to=2026-01-01',
        )
        .set('Authorization', auth(1))
        .expect(200);
      assert.deepEqual(
        list.body.data.map((o: { order_id: string }) => o.order_id),
        [first],
      );
      await api()
        .post(`/api/v1/restaurant/orders/${first}/reject`)
        .set('Authorization', auth(1))
        .expect(200);
      const history = await api()
        .get('/api/v1/customer/orders?scope=history&status=Rejected')
        .set('Authorization', auth(0))
        .expect(200);
      assert.ok(
        history.body.data.some(
          (o: { order_id: string }) => o.order_id === first,
        ),
      );
    },
  );
});
