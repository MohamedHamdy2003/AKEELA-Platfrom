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
let app: INestApplication;
let db: DataSource;
const tokens: string[] = [];
const userIds: string[] = [];
let restId: string;
let catId: string;
let prodId: string;
let addonId: string;
let offerId: string;
let savedId: string;
const address = {
  address_line: 'New Street',
  longitude: '32.2800000',
  latitude: '30.6000000',
};
const api = () => request(app.getHttpServer());
const auth = (index = 0) => `Bearer ${tokens[index]}`;
const add = (quantity = 1, addons = [{ addon_id: addonId, quantity }]) =>
  api()
    .post('/api/v1/customer/cart/items')
    .set('Authorization', auth())
    .send({ rest_id: restId, prod_id: prodId, quantity, addons });
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
    'TRUNCATE order_item_addons,order_items,orders,cart_item_addons,cart_items,carts,delivery_drivers,offers,product_addons,addons,products,categories,customer_addresses,auth_sessions,auth_challenges,admin_profiles,delivery_company_profiles,restaurant_profiles,customer_profiles,users RESTART IDENTITY',
  );
  const hash = await app.get(AuthCryptoService).hashPassword('TestPassword123');
  for (const index of [0, 1, 2]) {
    const email = `checkout-${index}-${randomUUID()}@example.com`;
    const role = index === 2 ? 'Restaurant' : 'Customer';
    const [user] = await db.query(
      'INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING user_id',
      ['Test User', email, hash, `+20111111110${index}`, role],
    );
    userIds.push(user.user_id);
    if (role === 'Customer')
      await db.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [
        user.user_id,
      ]);
    else {
      const [rest] = await db.query(
        "INSERT INTO restaurant_profiles(user_id,rest_title,rest_address,longitude,latitude,opens_at,closes_at,activation_status) VALUES($1,'Test Kitchen','Street',32.28,30.60,'00:00:00','23:59:59','Active') RETURNING rest_id",
        [user.user_id],
      );
      restId = rest.rest_id;
    }
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123' })
      .expect(200);
    tokens.push(login.body.data.tokens.access_token);
  }
  const [cat] = await db.query(
    "INSERT INTO categories(rest_id,cat_title) VALUES($1,'Food') RETURNING cat_id",
    [restId],
  );
  catId = cat.cat_id;
  const [prod] = await db.query(
    "INSERT INTO products(rest_id,cat_id,prod_name,price) VALUES($1,$2,'Burger','3.10') RETURNING prod_id",
    [restId, catId],
  );
  prodId = prod.prod_id;
  const [addon] = await db.query(
    "INSERT INTO addons(rest_id,addon_name,addon_price) VALUES($1,'Cheese','0.29') RETURNING addon_id",
    [restId],
  );
  addonId = addon.addon_id;
  await db.query(
    'INSERT INTO product_addons(rest_id,prod_id,addon_id) VALUES($1,$2,$3)',
    [restId, prodId, addonId],
  );
  const [offer] = await db.query(
    "INSERT INTO offers(rest_id,offer_title,initial_price,real_price,starts_at,expires_at) VALUES($1,'Offer',20,10,now()-interval '1 day',now()+interval '1 day') RETURNING offer_id",
    [restId],
  );
  offerId = offer.offer_id;
  const saved = await api()
    .post('/api/v1/customer/addresses')
    .set('Authorization', auth())
    .send({ ...address, address_title: 'Home' })
    .expect(201);
  savedId = saved.body.data.address_id;
});
after(async () => {
  if (app) await app.close();
});
test('Features 11 and 12: cart and checkout with actual PostgreSQL', async (t) => {
  await t.test('customer role, strict allowlists and empty cart', async () => {
    await api().get('/api/v1/customer/cart').expect(401);
    await api()
      .get('/api/v1/customer/cart')
      .set('Authorization', auth(2))
      .expect(403);
    const empty = await api()
      .get('/api/v1/customer/cart')
      .set('Authorization', auth())
      .expect(200);
    assert.equal(empty.body.data.cart_id, null);
    await add(0).expect(422);
    await api()
      .post('/api/v1/customer/orders')
      .set('Authorization', auth())
      .send({ delivery_address: address, checkout_key: 'rejected' })
      .expect(422);
    await api()
      .post('/api/v1/customer/orders')
      .set('Authorization', auth())
      .send({ delivery_address: [address] })
      .expect(422);
  });
  await t.test(
    'concurrent first adds merge choices; distinct addon ratios stay separate',
    async () => {
      const results = await Promise.all([add(), add()]);
      assert.deepEqual(
        results.map((r) => r.status),
        [201, 201],
      );
      const cart = await api()
        .get('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
      assert.equal(cart.body.data.items.length, 1);
      assert.equal(cart.body.data.items[0].quantity, 2);
      assert.equal(cart.body.data.items[0].addons[0].quantity, 2);
      assert.equal(cart.body.data.subtotal, '6.78');
      await add(1, [{ addon_id: addonId, quantity: 2 }]).expect(201);
      const distinct = await api()
        .get('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
      assert.equal(distinct.body.data.items.length, 2);
      const id = distinct.body.data.items[0].cart_item_id;
      await api()
        .patch(`/api/v1/customer/cart/items/${id}`)
        .set('Authorization', auth(1))
        .send({ quantity: 2 })
        .expect(404);
      await api()
        .patch(`/api/v1/customer/cart/items/${id}`)
        .set('Authorization', auth())
        .send({ quantity: 3 })
        .expect(422);
      await api()
        .patch(`/api/v1/customer/cart/items/${id}`)
        .set('Authorization', auth())
        .send({ quantity: 0 })
        .expect(200);
      await api()
        .post('/api/v1/customer/cart/items')
        .set('Authorization', auth())
        .send({ rest_id: '999', prod_id: prodId, quantity: 1 })
        .expect(409);
      await api()
        .delete('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
    },
  );
  await t.test(
    'one product or offer, allowed addons, and inactive selections',
    async () => {
      await api()
        .post('/api/v1/customer/cart/items')
        .set('Authorization', auth())
        .send({
          rest_id: restId,
          prod_id: prodId,
          offer_id: offerId,
          quantity: 1,
        })
        .expect(422);
      await api()
        .post('/api/v1/customer/cart/items')
        .set('Authorization', auth())
        .send({
          rest_id: restId,
          offer_id: offerId,
          quantity: 1,
          addons: [{ addon_id: addonId, quantity: 1 }],
        })
        .expect(422);
      await add().expect(201);
      await db.query('UPDATE categories SET is_active=false WHERE cat_id=$1', [
        catId,
      ]);
      const unavailable = await api()
        .get('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
      assert.equal(unavailable.body.data.items[0].is_available, false);
      await api()
        .post('/api/v1/customer/orders')
        .set('Authorization', auth())
        .send({ delivery_address: address })
        .expect(409);
      await api()
        .delete(
          `/api/v1/customer/cart/items/${unavailable.body.data.items[0].cart_item_id}`,
        )
        .set('Authorization', auth())
        .expect(200);
      await db.query('UPDATE categories SET is_active=true WHERE cat_id=$1', [
        catId,
      ]);
    },
  );
  await t.test(
    'quote accepts either address, no tokens, and fixed EGP 30 fee',
    async () => {
      await add(2).expect(201);
      const quote = await api()
        .post('/api/v1/customer/cart/quote')
        .set('Authorization', auth())
        .send({ address_id: savedId })
        .expect(200);
      assert.equal(quote.body.data.total_price, '36.78');
      assert.equal(quote.body.data.delivery_fee, '30.00');
      assert.equal(quote.body.data.quote_token, undefined);
      await api()
        .post('/api/v1/customer/cart/quote')
        .set('Authorization', auth())
        .send({ address_id: savedId, delivery_address: address })
        .expect(422);
      await api()
        .post('/api/v1/customer/cart/quote')
        .set('Authorization', auth())
        .send({})
        .expect(422);
      await api()
        .post('/api/v1/customer/cart/quote')
        .set('Authorization', auth(1))
        .send({ address_id: savedId })
        .expect(409);
    },
  );
  let orderId: string;
  await t.test(
    'checkout uses current prices, snapshots and clears atomically',
    async () => {
      await db.query("UPDATE products SET price='4.10' WHERE prod_id=$1", [
        prodId,
      ]);
      const results = await Promise.all(
        [1, 2].map(() =>
          api()
            .post('/api/v1/customer/orders')
            .set('Authorization', auth())
            .send({ delivery_address: address, notes: 'Call me' }),
        ),
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
      const placed = results.find((r) => r.status === 201)!;
      orderId = placed.body.data.order_id;
      assert.equal(placed.body.data.total_price, '38.78');
      assert.equal(placed.body.data.items[0].subtotal, '8.20');
      assert.equal(placed.body.data.items[0].addons[0].subtotal, '0.58');
      assert.equal(placed.body.data.company_id, null);
      assert.equal(
        (
          await api()
            .get('/api/v1/customer/cart')
            .set('Authorization', auth())
            .expect(200)
        ).body.data.cart_id,
        null,
      );
      await db.query(
        "UPDATE products SET prod_name='Changed',price='99.99' WHERE prod_id=$1",
        [prodId],
      );
      const saved = await api()
        .get(`/api/v1/customer/orders/${orderId}`)
        .set('Authorization', auth())
        .expect(200);
      assert.equal(saved.body.data.items[0].item_name, 'Burger');
      assert.equal(saved.body.data.total_price, '38.78');
      assert.equal(
        (
          await db.query(
            'SELECT count(*) FROM customer_addresses WHERE user_id=$1',
            [userIds[0]],
          )
        )[0].count,
        '1',
      );
      await api()
        .get(`/api/v1/customer/orders/${orderId}`)
        .set('Authorization', auth(1))
        .expect(404);
    },
  );
  await t.test(
    'pending cancellation, history ownership, pagination and final-state protection',
    async () => {
      await api()
        .post(`/api/v1/customer/orders/${orderId}/cancel`)
        .set('Authorization', auth())
        .expect(200);
      await api()
        .post(`/api/v1/customer/orders/${orderId}/cancel`)
        .set('Authorization', auth())
        .expect(409);
      const history = await api()
        .get(
          '/api/v1/customer/orders?scope=history&status=Cancelled&per_page=1',
        )
        .set('Authorization', auth())
        .expect(200);
      assert.equal(history.body.meta.total, 1);
      const other = await api()
        .get('/api/v1/customer/orders?scope=history')
        .set('Authorization', auth(1))
        .expect(200);
      assert.equal(other.body.meta.total, 0);
      assert.equal(
        (await db.query('SELECT count(*) FROM orders_history'))[0].count,
        '1',
      );
    },
  );
  await t.test(
    'unavailable restaurant and closed hours block checkout; totals cannot overflow',
    async () => {
      await add().expect(201);
      await db.query(
        "UPDATE restaurant_profiles SET activation_status='Suspended' WHERE rest_id=$1",
        [restId],
      );
      await api()
        .post('/api/v1/customer/orders')
        .set('Authorization', auth())
        .send({ address_id: savedId })
        .expect(409);
      await db.query(
        "UPDATE restaurant_profiles SET activation_status='Active',opens_at='00:00:00',closes_at='00:00:01' WHERE rest_id=$1",
        [restId],
      );
      await api()
        .post('/api/v1/customer/orders')
        .set('Authorization', auth())
        .send({ address_id: savedId })
        .expect(409);
      await db.query(
        "UPDATE restaurant_profiles SET opens_at='00:00:00',closes_at='23:59:59' WHERE rest_id=$1",
        [restId],
      );
      await db.query(
        "UPDATE products SET price='9999999999.99' WHERE prod_id=$1",
        [prodId],
      );
      await add(2).expect(422);
      await db.query("UPDATE products SET price='3.10' WHERE prod_id=$1", [
        prodId,
      ]);
    },
  );
  await t.test(
    'failure inserting order addons rolls back the whole order and preserves cart',
    async () => {
      const before = (await db.query('SELECT count(*) FROM orders'))[0].count;
      await db.query(
        "CREATE FUNCTION test_reject_addon() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END; $$; CREATE TRIGGER test_reject_addon BEFORE INSERT ON order_item_addons FOR EACH ROW EXECUTE FUNCTION test_reject_addon();",
      );
      try {
        await api()
          .post('/api/v1/customer/orders')
          .set('Authorization', auth())
          .send({ address_id: savedId })
          .expect(500);
      } finally {
        await db.query(
          'DROP TRIGGER test_reject_addon ON order_item_addons; DROP FUNCTION test_reject_addon();',
        );
      }
      assert.equal(
        (await db.query('SELECT count(*) FROM orders'))[0].count,
        before,
      );
      assert.ok(
        (
          await api()
            .get('/api/v1/customer/cart')
            .set('Authorization', auth())
            .expect(200)
        ).body.data.items.length,
      );
    },
  );
  await t.test(
    'offer checkout cannot carry addons and saved address is snapshotted',
    async () => {
      await api()
        .delete('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
      await api()
        .post('/api/v1/customer/cart/items')
        .set('Authorization', auth())
        .send({ rest_id: restId, offer_id: offerId, quantity: 2 })
        .expect(201);
      const order = await api()
        .post('/api/v1/customer/orders')
        .set('Authorization', auth())
        .send({ address_id: savedId })
        .expect(201);
      assert.equal(order.body.data.total_price, '50.00');
      assert.deepEqual(order.body.data.items[0].addons, []);
      await api()
        .delete(`/api/v1/customer/addresses/${savedId}`)
        .set('Authorization', auth())
        .expect(200);
      const read = await api()
        .get(`/api/v1/customer/orders/${order.body.data.order_id}`)
        .set('Authorization', auth())
        .expect(200);
      assert.equal(read.body.data.customer_address, 'New Street');
    },
  );
  await t.test(
    'quantities above 100, inactive links, and foreign addresses',
    async () => {
      await add(101).expect(201);
      await db.query(
        'UPDATE product_addons SET is_active=false WHERE rest_id=$1 AND prod_id=$2 AND addon_id=$3',
        [restId, prodId, addonId],
      );
      await api()
        .post('/api/v1/customer/orders')
        .set('Authorization', auth())
        .send({ delivery_address: address })
        .expect(409);
      const view = await api()
        .get('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
      assert.equal(view.body.data.items[0].is_available, false);
      await db.query(
        'UPDATE product_addons SET is_active=true WHERE rest_id=$1 AND prod_id=$2 AND addon_id=$3',
        [restId, prodId, addonId],
      );
      const other = await api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', auth(1))
        .send({ ...address, address_title: 'Other home' })
        .expect(201);
      await api()
        .post('/api/v1/customer/cart/quote')
        .set('Authorization', auth())
        .send({ address_id: other.body.data.address_id })
        .expect(404);
      await api()
        .delete('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
    },
  );
  await t.test(
    'database constraints and cart deletion preserve history',
    async () => {
      const [cart] = await db.query(
        'INSERT INTO carts(customer_id,rest_id) VALUES($1,$2) RETURNING cart_id',
        [userIds[0], restId],
      );
      await assert.rejects(
        db.query(
          'INSERT INTO cart_items(cart_id,rest_id,quantity) VALUES($1,$2,1)',
          [cart.cart_id, restId],
        ),
        (error: unknown) =>
          (error as { driverError?: { code?: string } }).driverError?.code ===
          '23514',
      );
      await assert.rejects(
        db.query('DELETE FROM products WHERE prod_id=$1', [prodId]),
        (error: unknown) =>
          (error as { driverError?: { code?: string } }).driverError?.code ===
          '23503',
      );
      const count = (await db.query('SELECT count(*) FROM orders'))[0].count;
      await api()
        .delete('/api/v1/customer/cart')
        .set('Authorization', auth())
        .expect(200);
      assert.equal(
        (await db.query('SELECT count(*) FROM orders'))[0].count,
        count,
      );
    },
  );
  await t.test(
    'entity metadata agrees with all reviewed migrations',
    async () => {
      const schema = await db.driver.createSchemaBuilder().log();
      assert.deepEqual(
        schema.upQueries.map((q) => q.query),
        [],
      );
    },
  );
});
