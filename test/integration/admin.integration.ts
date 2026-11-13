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

const adminEmail = `admin-${randomUUID()}@example.com`;
const customerEmail = `customer-${randomUUID()}@example.com`;
const restaurantEmail = `restaurant-${randomUUID()}@example.com`;
const commonPassword = 'TestPassword123';

let adminToken: string;
let customerToken: string;
let adminUserId: string;
let customerUserId: string;
let restaurantId: string;

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

  // 1. Seed the Admin user directly in DB (simulating the CLI command)
  const adminHash = await crypto.hashPassword(commonPassword);
  const adminInsert = await db.query(
    `INSERT INTO users (full_name, email, phone_number, password_hash, role, is_active, email_verified_at)
     VALUES ($1, $2, $3, $4, 'Admin', true, NOW()) RETURNING user_id`,
    ['Platform Admin', adminEmail, '+201099999999', adminHash],
  );
  adminUserId = adminInsert[0].user_id;
  await db.query(`INSERT INTO admin_profiles (user_id) VALUES ($1)`, [
    adminUserId,
  ]);

  // 2. Register & verify a Customer
  await api().post('/api/v1/auth/register').send({
    full_name: 'Regular Customer',
    email: customerEmail,
    password: commonPassword,
    phone: '+201088888888',
  });
  // Mark email as verified in DB directly for test convenience
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [customerEmail],
  );
  const cusRow = await db.query(`SELECT user_id FROM users WHERE email = $1`, [
    customerEmail,
  ]);
  customerUserId = cusRow[0].user_id;

  // 3. Register a Restaurant
  const restRes = await api()
    .post('/api/v1/auth/register/restaurant')
    .send({
      full_name: 'Restaurant Owner',
      email: restaurantEmail,
      password: commonPassword,
      phone: '+201077777777',
      profile: {
        rest_title: 'Pyramids Grill',
        rest_address: '10 Cairo St',
        longitude: '31.2357000',
        latitude: '30.0444000',
        opens_at: '09:00:00',
        closes_at: '23:00:00',
      },
    });
  assert.equal(restRes.status, 201);
  const restProf = await db.query(
    `SELECT rest_id FROM restaurant_profiles WHERE rest_title = $1`,
    ['Pyramids Grill'],
  );
  restaurantId = restProf[0].rest_id;

  // Log in as Admin and Customer
  adminToken = await loginUser(adminEmail);
  customerToken = await loginUser(customerEmail);
});

after(async () => {
  if (app) await app.close();
});

test('Feature 02 — Admin Accounts, Roles, Activation & Boundaries', async (t) => {
  await t.test('enforces Admin role on all admin routes', async () => {
    // 401 unauthenticated
    assert.equal((await api().get('/api/v1/admin/users')).status, 401);
    assert.equal(
      (await api().get(`/api/v1/admin/users/${adminUserId}`)).status,
      401,
    );
    assert.equal((await api().post('/api/v1/admin/users')).status, 401);
    assert.equal(
      (await api().patch(`/api/v1/admin/users/${adminUserId}/activity`)).status,
      401,
    );
    assert.equal((await api().get('/api/v1/admin/restaurants')).status, 401);
    assert.equal(
      (
        await api().patch(
          `/api/v1/admin/restaurants/${restaurantId}/activation`,
        )
      ).status,
      401,
    );

    // 403 when authenticated as Customer
    const listUsers = await api()
      .get('/api/v1/admin/users')
      .set('Authorization', bearer(customerToken));
    assert.equal(listUsers.status, 403);
    assert.equal(listUsers.body.error.code, 'FORBIDDEN');

    const getRes = await api()
      .get('/api/v1/admin/restaurants')
      .set('Authorization', bearer(customerToken));
    assert.equal(getRes.status, 403);
    assert.equal(getRes.body.error.code, 'FORBIDDEN');
  });

  await t.test('GET /admin/users lists accounts with pagination', async () => {
    const res = await api()
      .get('/api/v1/admin/users?page=1&per_page=10')
      .set('Authorization', bearer(adminToken));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.per_page, 10);
    assert.ok(res.body.data.length >= 3); // Admin, Customer, Restaurant

    // Filter by role
    const filtered = await api()
      .get('/api/v1/admin/users?role=Customer')
      .set('Authorization', bearer(adminToken));
    assert.equal(filtered.status, 200);
    assert.equal(
      filtered.body.data.every((u: { role: string }) => u.role === 'Customer'),
      true,
    );
  });

  await t.test(
    'GET /admin/users/{user_id} reads account and profile',
    async () => {
      const res = await api()
        .get(`/api/v1/admin/users/${adminUserId}`)
        .set('Authorization', bearer(adminToken));
      assert.equal(res.status, 200);
      assert.equal(res.body.data.user_id, adminUserId);
      assert.equal(res.body.data.role, 'Admin');
      assert.equal(res.body.data.profile.profile_role, 'Admin');

      const notFound = await api()
        .get('/api/v1/admin/users/999999999')
        .set('Authorization', bearer(adminToken));
      assert.equal(notFound.status, 404);
    },
  );

  await t.test('POST /admin/users creates a Delivery_Company', async () => {
    const companyEmail = `delivery-${randomUUID()}@example.com`;
    const res = await api()
      .post('/api/v1/admin/users')
      .set('Authorization', bearer(adminToken))
      .send({
        full_name: 'Express Delivery Owner',
        email: companyEmail,
        password: commonPassword,
        phone: '+201011112222',
        role: 'Delivery_Company',
        profile: {
          company_name: 'Express Logistics',
          company_phone: '+201011112222',
          company_email: 'office@express.com',
          company_address: '45 Nile Street, Maadi',
          is_active: true,
        },
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.role, 'Delivery_Company');
    assert.equal(res.body.data.email_verified_at, null);
    assert.equal(res.body.data.profile.company_name, 'Express Logistics');
  });

  await t.test('POST /admin/users rejects creating another Admin', async () => {
    const res = await api()
      .post('/api/v1/admin/users')
      .set('Authorization', bearer(adminToken))
      .send({
        full_name: 'Second Admin',
        email: `admin2-${randomUUID()}@example.com`,
        password: commonPassword,
        phone: '+201055556666',
        role: 'Admin',
      });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CONFLICT');
  });

  await t.test(
    'PATCH /admin/users/{user_id}/activity toggles login and protects sole Admin',
    async () => {
      // Attempt to disable the Admin -> 409
      const disableAdmin = await api()
        .patch(`/api/v1/admin/users/${adminUserId}/activity`)
        .set('Authorization', bearer(adminToken))
        .send({ is_active: false });
      assert.equal(disableAdmin.status, 409);
      assert.equal(disableAdmin.body.error.code, 'CONFLICT');

      // Disable customer
      const disableCus = await api()
        .patch(`/api/v1/admin/users/${customerUserId}/activity`)
        .set('Authorization', bearer(adminToken))
        .send({ is_active: false });
      assert.equal(disableCus.status, 200);
      assert.equal(disableCus.body.data.is_active, false);

      // Customer can no longer log in
      const loginAttempt = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: commonPassword });
      assert.equal(loginAttempt.status, 403);
      assert.equal(loginAttempt.body.error.code, 'FORBIDDEN');

      // Re-enable customer
      const enableCus = await api()
        .patch(`/api/v1/admin/users/${customerUserId}/activity`)
        .set('Authorization', bearer(adminToken))
        .send({ is_active: true });
      assert.equal(enableCus.status, 200);
      assert.equal(enableCus.body.data.is_active, true);

      // Customer can log in again
      const loginAgain = await api()
        .post('/api/v1/auth/login')
        .send({ email: customerEmail, password: commonPassword });
      assert.equal(loginAgain.status, 200);
    },
  );

  await t.test(
    'GET /admin/restaurants and PATCH activation status',
    async () => {
      // List restaurants for review
      const listRes = await api()
        .get('/api/v1/admin/restaurants?activation_status=Pending')
        .set('Authorization', bearer(adminToken));
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.success, true);
      assert.ok(listRes.body.data.length >= 1);
      const item = listRes.body.data.find(
        (r: { profile: { rest_id: string } }) =>
          r.profile.rest_id === restaurantId,
      );
      assert.ok(item);
      assert.equal(item.profile.activation_status, 'Pending');
      assert.equal(item.owner.email, restaurantEmail);

      // Activate restaurant
      const activateRes = await api()
        .patch(`/api/v1/admin/restaurants/${restaurantId}/activation`)
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Active' });
      assert.equal(activateRes.status, 200);
      assert.equal(activateRes.body.data.activation_status, 'Active');

      // Suspend restaurant
      const suspendRes = await api()
        .patch(`/api/v1/admin/restaurants/${restaurantId}/activation`)
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Suspended' });
      assert.equal(suspendRes.status, 200);
      assert.equal(suspendRes.body.data.activation_status, 'Suspended');

      // Reactivate restaurant
      const reactivateRes = await api()
        .patch(`/api/v1/admin/restaurants/${restaurantId}/activation`)
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Active' });
      assert.equal(reactivateRes.status, 200);
      assert.equal(reactivateRes.body.data.activation_status, 'Active');

      // 404 on unknown restaurant
      const notFound = await api()
        .patch('/api/v1/admin/restaurants/999999999/activation')
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Active' });
      assert.equal(notFound.status, 404);
    },
  );
});
