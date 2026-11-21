import { io, Socket } from 'socket.io-client';
import { JwtService } from '@nestjs/jwt';
import { AddressInfo } from 'node:net';
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
      // Delivering an Accepted order before driver assignment/Picked_Up is rejected.
      await deliver(id).expect(409);
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
      // Re-assigning a driver while Picked_Up is allowed (idempotent status).
      await assign(id, drivers[1]).expect(200);
      await api()
        .post(`/api/v1/delivery-company/orders/${id}/pickup`)
        .set('Authorization', auth(3))
        .send({ status: 'Delivered' })
        .expect(422);
      // Explicit pickup is idempotent when already Picked_Up.
      await pickup(id).expect(200);
      // Re-assigning after Picked_Up is still allowed.
      await assign(id).expect(200);
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
  await t.test(
    'status counts return accurate per-scope grouped totals and enforce role isolation',
    async () => {
      await api()
        .get('/api/v1/admin/orders/counts')
        .set('Authorization', auth(3))
        .expect(403);
      await api()
        .get('/api/v1/delivery-company/orders/counts')
        .set('Authorization', auth(5))
        .expect(403);
      const adminCounts = await api()
        .get('/api/v1/admin/orders/counts')
        .set('Authorization', auth(5))
        .expect(200);
      assert.deepEqual(Object.keys(adminCounts.body.data).sort(), [
        'Accepted',
        'Cancelled',
        'Delivered',
        'Failed',
        'Pending',
        'Picked_Up',
        'Rejected',
      ]);
      const expectedTotal = Number(
        (await db.query('SELECT count(*) FROM orders'))[0].count,
      );
      const summedAdmin = Object.values(
        adminCounts.body.data as Record<string, number>,
      ).reduce((acc, n) => acc + n, 0);
      assert.equal(summedAdmin, expectedTotal);

      const companyCounts = await api()
        .get('/api/v1/delivery-company/orders/counts')
        .set('Authorization', auth(3))
        .expect(200);
      const expectedCompany = Number(
        (
          await db.query('SELECT count(*) FROM orders WHERE company_id=$1', [
            companies[0],
          ])
        )[0].count,
      );
      const summedCompany = Object.values(
        companyCounts.body.data as Record<string, number>,
      ).reduce((acc, n) => acc + n, 0);
      assert.equal(summedCompany, expectedCompany);

      const otherCompanyCounts = await api()
        .get('/api/v1/delivery-company/orders/counts')
        .set('Authorization', auth(4))
        .expect(200);
      const summedOther = Object.values(
        otherCompanyCounts.body.data as Record<string, number>,
      ).reduce((acc, n) => acc + n, 0);
      assert.equal(summedOther, 0);
    },
  );
  await t.test(
    'admin analytics enforces role isolation, validates range, and returns accurate metrics',
    async () => {
      await api()
        .get('/api/v1/admin/analytics')
        .set('Authorization', auth(3))
        .expect(403);
      await api()
        .get('/api/v1/admin/analytics?range=invalid')
        .set('Authorization', auth(5))
        .expect(422);

      const analytics30 = await api()
        .get('/api/v1/admin/analytics?range=30d')
        .set('Authorization', auth(5))
        .expect(200);
      const data30 = analytics30.body.data;
      assert.equal(data30.range, '30d');
      assert.equal(data30.daily_series.length, 30);
      assert.equal(data30.peak_hours.length, 24);
      assert.ok(data30.previous_kpis !== null);
      assert.ok(data30.kpis.delivered_orders >= 1);
      assert.match(data30.kpis.delivered_gmv, /^\d+\.\d{2}$/);
      assert.match(data30.kpis.avg_order_value, /^\d+\.\d{2}$/);
      assert.ok(data30.top_restaurants.length >= 1);
      assert.ok(data30.top_items.length >= 1);
      assert.equal(typeof data30.alerts.stale_pending_orders, 'number');
      assert.ok(data30.platform_totals.restaurants_total >= 1);
      assert.ok(data30.platform_totals.active_drivers >= 1);

      const analyticsAll = await api()
        .get('/api/v1/admin/analytics?range=all')
        .set('Authorization', auth(5))
        .expect(200);
      assert.equal(analyticsAll.body.data.range, 'all');
      assert.equal(analyticsAll.body.data.previous_kpis, null);
      const totalDb = Number(
        (await db.query('SELECT count(*) FROM orders'))[0].count,
      );
      assert.equal(analyticsAll.body.data.kpis.total_orders, totalDb);
    },
  );
  await t.test(
    'delivery company analytics enforces company isolation, validates range, and returns fleet & SLA metrics',
    async () => {
      await api()
        .get('/api/v1/delivery-company/analytics')
        .set('Authorization', auth(5))
        .expect(403);
      await api()
        .get('/api/v1/delivery-company/analytics?range=bad')
        .set('Authorization', auth(3))
        .expect(422);

      const analytics30 = await api()
        .get('/api/v1/delivery-company/analytics?range=30d')
        .set('Authorization', auth(3))
        .expect(200);
      const data30 = analytics30.body.data;
      assert.equal(data30.range, '30d');
      assert.equal(data30.daily_series.length, 30);
      assert.equal(data30.peak_hours.length, 24);
      assert.ok(data30.previous_kpis !== null);
      assert.ok(data30.kpis.delivered_orders >= 1);
      assert.match(data30.kpis.delivery_fees_earned, /^\d+\.\d{2}$/);
      assert.match(data30.kpis.cod_collected_value, /^\d+\.\d{2}$/);
      assert.ok(data30.fleet.active_drivers >= 1);
      assert.ok(data30.driver_leaderboard.length >= 1);
      assert.ok(data30.top_pickup_restaurants.length >= 1);

      const otherCompany = await api()
        .get('/api/v1/delivery-company/analytics?range=all')
        .set('Authorization', auth(4))
        .expect(200);
      assert.equal(otherCompany.body.data.previous_kpis, null);
      assert.equal(otherCompany.body.data.kpis.assigned_orders, 0);
      assert.equal(otherCompany.body.data.kpis.delivery_fees_earned, '0.00');
      assert.equal(otherCompany.body.data.top_pickup_restaurants.length, 0);
    },
  );
});

test('Realtime orders: authenticated role isolation, committed events, revocation and expiry', async () => {
  await db.query('UPDATE users SET is_active=true,email_verified_at=now()');
  await db.query(
    "UPDATE restaurant_profiles SET activation_status='Active',is_active=true",
  );
  config.set('DEFAULT_DELIVERY_COMPANY_ID', companies[0]);
  await app.listen(0, '127.0.0.1');
  const url =
    'http://127.0.0.1:' +
    (app.getHttpServer().address() as AddressInfo).port +
    '/orders';
  const clients: Socket[] = [];
  const seen: Array<
    Array<{
      event: string;
      data: { order_id: string; status: string; updated_at: string };
    }>
  > = [];
  const waitFor = async (check: () => boolean) => {
    const end = Date.now() + 3500;
    while (!check()) {
      if (Date.now() > end) throw Error('Realtime assertion timed out');
      await new Promise((r) => setTimeout(r, 20));
    }
  };
  const connect = async (token: string, origin?: string) => {
    const socket = io(url, {
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
      forceNew: true,
      extraHeaders: origin ? { Origin: origin } : undefined,
    });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(Error('Connection timed out')),
        3500,
      );
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    return socket;
  };
  try {
    await assert.rejects(connect('invalid'), /UNAUTHENTICATED/);
    await assert.rejects(
      connect(tokens[5]!, 'https://untrusted.example'),
      /ORIGIN_NOT_ALLOWED/,
    );
    const [stranger] = await db.query(
      "INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at) SELECT 'Other customer',$1,password_hash,'+201222222222','Customer',now() FROM users WHERE user_id=$2 RETURNING user_id",
      ['stranger-' + randomUUID() + '@example.com', users[0]],
    );
    await db.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [
      stranger.user_id,
    ]);
    const other = await api()
      .post('/api/v1/auth/login')
      .send({
        email: (
          await db.query('SELECT email FROM users WHERE user_id=$1', [
            stranger.user_id,
          ])
        )[0].email,
        password: 'TestPassword123',
      })
      .expect(200);
    const allTokens = [...tokens, other.body.data.tokens.access_token];
    const live: Socket[] = [];
    for (const [index, token] of allTokens.entries()) {
      const socket = await connect(token);
      live.push(socket);
      seen[index] = [];
      for (const event of ['order.created', 'order.updated'])
        socket.on(event, (data) => seen[index]!.push({ event, data }));
    }
    live[6]!.emit('join', { room: 'admin', order_id: '1' });
    const id = await newOrder();
    await waitFor(() =>
      [0, 1, 5].every((index) =>
        seen[index]!.some(
          (item) => item.event === 'order.created' && item.data.order_id === id,
        ),
      ),
    );
    config.set('DEFAULT_DELIVERY_COMPANY_ID', null);
    await accept(id).expect(409);
    assert.equal(
      seen[5]!.filter((item) => item.event === 'order.updated').length,
      0,
    );
    config.set('DEFAULT_DELIVERY_COMPANY_ID', companies[0]);
    await accept(id).expect(200);
    await waitFor(() =>
      seen[3]!.some((item) => item.data.status === 'Accepted'),
    );
    const acceptedEvents = seen[5]!.length;
    await accept(id).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(seen[5]!.length, acceptedEvents);
    await assign(id).expect(200);
    await pickup(id).expect(200);
    await deliver(id).expect(200);
    await waitFor(() =>
      [0, 1, 3, 5].every((index) =>
        seen[index]!.some((item) => item.data.status === 'Delivered'),
      ),
    );
    for (const index of [2, 4, 6]) assert.deepEqual(seen[index], []);
    assert.match(seen[5]![0]!.data.updated_at, /\+(02|03):00$/);
    assert.deepEqual(Object.keys(seen[5]![0]!.data).sort(), [
      'company_id',
      'driver_id',
      'order_id',
      'status',
      'updated_at',
    ]);
    const second = await newOrder();
    await api()
      .post('/api/v1/auth/logout')
      .set('Authorization', auth(0))
      .expect(200);
    await accept(second).expect(200);
    await waitFor(() => !live[0]!.connected);
    assert.ok(
      !seen[0]!.some(
        (item) =>
          item.data.order_id === second && item.event === 'order.updated',
      ),
    );
    await db.query(
      "UPDATE restaurant_profiles SET activation_status='Suspended' WHERE rest_id=$1",
      [rests[0]],
    );
    await assign(second).expect(200);
    await waitFor(() => !live[1]!.connected);
    const payload = JSON.parse(
      Buffer.from(tokens[5]!.split('.')[1]!, 'base64url').toString(),
    ) as { sid: string };
    const short = await new JwtService().signAsync(
      { sub: users[5], sid: payload.sid },
      {
        secret: config.get('JWT_SECRET'),
        issuer: config.get('JWT_ISSUER'),
        audience: config.get('JWT_AUDIENCE'),
        expiresIn: 1,
      },
    );
    const expiring = await connect(short);
    await waitFor(() => !expiring.connected);
  } finally {
    for (const socket of clients) socket.disconnect();
  }
});
