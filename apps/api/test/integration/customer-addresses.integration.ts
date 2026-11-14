import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import request from 'supertest';
import { configureApplication } from '../../src/bootstrap';
import { AuthCryptoService } from '../../src/modules/auth/auth-crypto.service';

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
let crypto: AuthCryptoService;

const commonPassword = 'TestPassword123';
const customerAEmail = `customer-a-${randomUUID()}@example.com`;
const customerBEmail = `customer-b-${randomUUID()}@example.com`;
const adminEmail = `admin-${randomUUID()}@example.com`;

let customerAToken: string;
let customerBToken: string;
let adminToken: string;
let customerAId: string;
let customerBId: string;

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
  crypto = app.get(AuthCryptoService);

  await db.runMigrations({ transaction: 'all' });
  await db.query(
    'TRUNCATE order_item_addons, order_items, orders, cart_item_addons, cart_items, carts, delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );

  // 1. Seed Admin
  const adminHash = await crypto.hashPassword(commonPassword);
  const adminInsert = await db.query(
    `INSERT INTO users (full_name, email, phone_number, password_hash, role, is_active, email_verified_at)
     VALUES ($1, $2, $3, $4, 'Admin', true, NOW()) RETURNING user_id`,
    ['Platform Admin', adminEmail, '+201099990001', adminHash],
  );
  await db.query(`INSERT INTO admin_profiles (user_id) VALUES ($1)`, [
    adminInsert[0].user_id,
  ]);
  adminToken = await loginUser(adminEmail);

  // 2. Register & verify Customer A
  await api().post('/api/v1/auth/register').send({
    full_name: 'Customer One',
    email: customerAEmail,
    password: commonPassword,
    phone: '+201011110001',
  });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [customerAEmail],
  );
  const cusARow = await db.query(`SELECT user_id FROM users WHERE email = $1`, [
    customerAEmail,
  ]);
  customerAId = cusARow[0].user_id;
  customerAToken = await loginUser(customerAEmail);

  // 3. Register & verify Customer B
  await api().post('/api/v1/auth/register').send({
    full_name: 'Customer Two',
    email: customerBEmail,
    password: commonPassword,
    phone: '+201011110002',
  });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [customerBEmail],
  );
  const cusBRow = await db.query(`SELECT user_id FROM users WHERE email = $1`, [
    customerBEmail,
  ]);
  customerBId = cusBRow[0].user_id;
  customerBToken = await loginUser(customerBEmail);
});

after(async () => {
  if (app) await app.close();
});

test('Feature 03 — Customer Addresses', async (t) => {
  await t.test('enforces authentication and Customer role', async () => {
    // Unauthenticated
    assert.equal((await api().get('/api/v1/customer/addresses')).status, 401);
    assert.equal(
      (
        await api().post('/api/v1/customer/addresses').send({
          address_title: 'Home',
          address_line: '8 Main St',
          longitude: '32.2800000',
          latitude: '30.6000000',
        })
      ).status,
      401,
    );
    assert.equal(
      (await api().patch('/api/v1/customer/addresses/1').send({})).status,
      401,
    );
    assert.equal(
      (await api().put('/api/v1/customer/addresses/1/default')).status,
      401,
    );
    assert.equal(
      (await api().delete('/api/v1/customer/addresses/1')).status,
      401,
    );

    // Non-Customer role (Admin)
    const adminRes = await api()
      .get('/api/v1/customer/addresses')
      .set('Authorization', bearer(adminToken));
    assert.equal(adminRes.status, 403);
    assert.equal(adminRes.body.error.code, 'FORBIDDEN');
  });

  await t.test('validates address input fields and coordinates', async () => {
    // Missing required fields
    const missing = await api()
      .post('/api/v1/customer/addresses')
      .set('Authorization', bearer(customerAToken))
      .send({});
    assert.equal(missing.status, 422);
    assert.ok(missing.body.error.fields.address_title);
    assert.ok(missing.body.error.fields.address_line);
    assert.ok(missing.body.error.fields.longitude);
    assert.ok(missing.body.error.fields.latitude);

    // Invalid coordinates (out of range)
    const invalidCoords = await api()
      .post('/api/v1/customer/addresses')
      .set('Authorization', bearer(customerAToken))
      .send({
        address_title: 'Home',
        address_line: '8 Main Street',
        longitude: '200.0000000',
        latitude: '100.0000000',
      });
    assert.equal(invalidCoords.status, 422);
    assert.ok(invalidCoords.body.error.fields.longitude);
    assert.ok(invalidCoords.body.error.fields.latitude);
  });

  let address1Id: string;
  let address2Id: string;

  await t.test(
    'creates addresses, enforces 2-address cap, and handles default address swap',
    async () => {
      // 1. Create first address with is_default: false
      const res1 = await api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerAToken))
        .send({
          address_title: 'Home',
          address_line: '8 Main Street, floor 2',
          longitude: '32.2800000',
          latitude: '30.6000000',
          is_default: false,
        });
      assert.equal(res1.status, 201);
      assert.equal(res1.body.success, true);
      assert.equal(res1.body.data.address_title, 'Home');
      assert.equal(res1.body.data.user_id, customerAId);
      assert.equal(res1.body.data.is_default, false);
      address1Id = res1.body.data.address_id;

      // 2. Create second address with is_default: true (reaches the 2-address limit)
      const res2 = await api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerAToken))
        .send({
          address_title: 'Work',
          address_line: '15 Business Bay',
          longitude: '32.2850000',
          latitude: '30.6050000',
          is_default: true,
        });
      assert.equal(res2.status, 201);
      assert.equal(res2.body.data.is_default, true);
      address2Id = res2.body.data.address_id;

      // 3. Attempting to create a third address must be rejected with 409 CONFLICT
      const res3 = await api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerAToken))
        .send({
          address_title: 'Parents House',
          address_line: '22 Garden City',
          longitude: '32.2900000',
          latitude: '30.6100000',
          is_default: true,
        });
      assert.equal(res3.status, 409);
      assert.equal(res3.body.error.code, 'CONFLICT');
      assert.equal(
        res3.body.message,
        'Customers can save at most 2 addresses.',
      );

      // Verify in database that only address2 is default for Customer A
      const defaults = await db.query(
        `SELECT address_id, is_default FROM customer_addresses WHERE user_id = $1 AND is_default = true`,
        [customerAId],
      );
      assert.equal(defaults.length, 1);
      assert.equal(defaults[0].address_id, address2Id);
    },
  );

  await t.test(
    'PUT /customer/addresses/{id}/default atomically updates default',
    async () => {
      // Make address 1 the default
      const putRes = await api()
        .put(`/api/v1/customer/addresses/${address1Id}/default`)
        .set('Authorization', bearer(customerAToken));
      assert.equal(putRes.status, 200);
      assert.equal(putRes.body.success, true);
      assert.equal(putRes.body.data.address_id, address1Id);
      assert.equal(putRes.body.data.is_default, true);

      // Verify address 2 is no longer default
      const checkDefaults = await db.query(
        `SELECT address_id FROM customer_addresses WHERE user_id = $1 AND is_default = true`,
        [customerAId],
      );
      assert.equal(checkDefaults.length, 1);
      assert.equal(checkDefaults[0].address_id, address1Id);
    },
  );

  await t.test(
    'lists addresses with pagination and strict ownership',
    async () => {
      // Customer B creates an address
      const resB = await api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerBToken))
        .send({
          address_title: 'Customer B Place',
          address_line: '99 Other Road',
          longitude: '32.3000000',
          latitude: '30.6200000',
          is_default: true,
        });
      assert.equal(resB.status, 201);
      assert.equal(resB.body.data.user_id, customerBId);
      const addressBId = resB.body.data.address_id;

      // Customer A lists addresses (should have 2 addresses)
      const listA = await api()
        .get('/api/v1/customer/addresses?page=1&per_page=10')
        .set('Authorization', bearer(customerAToken));
      assert.equal(listA.status, 200);
      assert.equal(listA.body.data.length, 2);
      assert.equal(listA.body.meta.total, 2);
      // First in list must be the default address (address1Id)
      assert.equal(listA.body.data[0].address_id, address1Id);
      assert.equal(listA.body.data[0].is_default, true);
      // Customer B's address must NOT be present
      assert.ok(
        !listA.body.data.some(
          (a: { address_id: string }) => a.address_id === addressBId,
        ),
      );

      // Customer B lists addresses
      const listB = await api()
        .get('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerBToken));
      assert.equal(listB.status, 200);
      assert.equal(listB.body.data.length, 1);
      assert.equal(listB.body.data[0].address_id, addressBId);
    },
  );

  await t.test('enforces cross-customer ownership isolation', async () => {
    // Customer B creates an address
    const resB = await api()
      .post('/api/v1/customer/addresses')
      .set('Authorization', bearer(customerBToken))
      .send({
        address_title: 'B Secret Address',
        address_line: '100 Secret St',
        longitude: '32.3100000',
        latitude: '30.6300000',
      });
    const bAddrId = resB.body.data.address_id;

    // Customer A cannot update Customer B's address (returns 404)
    const patchRes = await api()
      .patch(`/api/v1/customer/addresses/${bAddrId}`)
      .set('Authorization', bearer(customerAToken))
      .send({ address_title: 'Hacked Title' });
    assert.equal(patchRes.status, 404);
    assert.equal(patchRes.body.error.code, 'NOT_FOUND');

    // Customer A cannot set Customer B's address as default (returns 404)
    const putRes = await api()
      .put(`/api/v1/customer/addresses/${bAddrId}/default`)
      .set('Authorization', bearer(customerAToken));
    assert.equal(putRes.status, 404);
    assert.equal(putRes.body.error.code, 'NOT_FOUND');

    // Customer A cannot delete Customer B's address (returns 404)
    const deleteRes = await api()
      .delete(`/api/v1/customer/addresses/${bAddrId}`)
      .set('Authorization', bearer(customerAToken));
    assert.equal(deleteRes.status, 404);
    assert.equal(deleteRes.body.error.code, 'NOT_FOUND');
  });

  await t.test('updates an owned address', async () => {
    const patchRes = await api()
      .patch(`/api/v1/customer/addresses/${address2Id}`)
      .set('Authorization', bearer(customerAToken))
      .send({
        address_title: 'Updated Work',
        address_line: '16 Business Bay North',
        longitude: '32.2855000',
        latitude: '30.6055000',
      });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.address_title, 'Updated Work');
    assert.equal(patchRes.body.data.address_line, '16 Business Bay North');
    assert.equal(patchRes.body.data.longitude, '32.2855000');
    assert.equal(patchRes.body.data.latitude, '30.6055000');
  });

  await t.test(
    'deletes an owned address and allows creating a new address after deletion',
    async () => {
      const delRes = await api()
        .delete(`/api/v1/customer/addresses/${address2Id}`)
        .set('Authorization', bearer(customerAToken));
      assert.equal(delRes.status, 200);
      assert.equal(delRes.body.success, true);
      assert.equal(delRes.body.message, 'Address deleted.');
      assert.equal(delRes.body.data, null);

      // Verify deleted in DB
      const checkDb = await db.query(
        `SELECT * FROM customer_addresses WHERE address_id = $1`,
        [address2Id],
      );
      assert.equal(checkDb.length, 0);

      // Deleting again returns 404
      const delAgain = await api()
        .delete(`/api/v1/customer/addresses/${address2Id}`)
        .set('Authorization', bearer(customerAToken));
      assert.equal(delAgain.status, 404);
      assert.equal(delAgain.body.error.code, 'NOT_FOUND');

      // Now Customer A has 1 address, so creating a 2nd address succeeds
      const newAddrRes = await api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerAToken))
        .send({
          address_title: 'Parents House',
          address_line: '22 Garden City',
          longitude: '32.2900000',
          latitude: '30.6100000',
          is_default: false,
        });
      assert.equal(newAddrRes.status, 201);
      assert.equal(newAddrRes.body.data.address_title, 'Parents House');
    },
  );

  await t.test(
    'database constraints prevent duplicate defaults and invalid coordinates',
    async () => {
      // 1. Partial unique index check: inserting another default address for customerA directly must fail
      await assert.rejects(
        async () => {
          await db.query(
            `INSERT INTO customer_addresses (user_id, address_title, address_line, longitude, latitude, is_default)
           VALUES ($1, 'Another Default', 'Line', 32.28, 30.60, true)`,
            [customerAId],
          );
        },
        (err: unknown) => {
          return (
            err instanceof QueryFailedError &&
            (err.driverError as { code?: string }).code === '23505'
          );
        },
      );

      // 2. Coordinate check constraints: longitude > 180
      await assert.rejects(
        async () => {
          await db.query(
            `INSERT INTO customer_addresses (user_id, address_title, address_line, longitude, latitude, is_default)
           VALUES ($1, 'Invalid Long', 'Line', 181.0, 30.60, false)`,
            [customerAId],
          );
        },
        (err: unknown) => {
          return (
            err instanceof QueryFailedError &&
            (err.driverError as { code?: string }).code === '23514'
          );
        },
      );

      // 3. Coordinate check constraints: latitude > 90
      await assert.rejects(
        async () => {
          await db.query(
            `INSERT INTO customer_addresses (user_id, address_title, address_line, longitude, latitude, is_default)
           VALUES ($1, 'Invalid Lat', 'Line', 32.28, 91.0, false)`,
            [customerAId],
          );
        },
        (err: unknown) => {
          return (
            err instanceof QueryFailedError &&
            (err.driverError as { code?: string }).code === '23514'
          );
        },
      );
    },
  );
});

test('concurrent address creation respects the two-address limit', async () => {
  await db.query('DELETE FROM customer_addresses WHERE user_id=$1', [
    customerAId,
  ]);
  const results = await Promise.all(
    [1, 2, 3].map((index) =>
      api()
        .post('/api/v1/customer/addresses')
        .set('Authorization', bearer(customerAToken))
        .send({
          address_title: 'Home ' + index,
          address_line: 'Main Street',
          longitude: '32.28',
          latitude: '30.60',
          is_default: true,
        }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 201, 409]);
  const [count] = await db.query(
    'SELECT count(*) AS total, count(*) FILTER(WHERE is_default) AS defaults FROM customer_addresses WHERE user_id=$1',
    [customerAId],
  );
  assert.equal(count.total, '2');
  assert.equal(count.defaults, '1');
});
