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

const commonPassword = 'TestPassword123';
const adminEmail = `admin-${randomUUID()}@example.com`;
const customerEmail = `customer-${randomUUID()}@example.com`;
const restaurantAEmail = `rest-a-${randomUUID()}@example.com`;
const restaurantBEmail = `rest-b-${randomUUID()}@example.com`;

let adminToken: string;
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
  crypto = app.get(AuthCryptoService);

  await db.runMigrations({ transaction: 'all' });
  await db.query(
    'TRUNCATE delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
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

  // 2. Register & verify Customer
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

  // 3. Register & verify Restaurant A
  const regARes = await api()
    .post('/api/v1/auth/register/restaurant')
    .send({
      full_name: 'Owner A',
      email: restaurantAEmail,
      password: commonPassword,
      phone: '+201022220001',
      profile: {
        rest_title: 'Original Kitchen A',
        rest_description: 'Fast food and grills',
        rest_image_url_mobile: 'https://example.com/rest-a.jpg',
        rest_address: '10 Corniche Street, Ismailia',
        longitude: '32.2700000',
        latitude: '30.5900000',
        opens_at: '09:00:00',
        closes_at: '23:00:00',
      },
    });
  assert.equal(regARes.status, 201);
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

  // 4. Register & verify Restaurant B
  const regBRes = await api()
    .post('/api/v1/auth/register/restaurant')
    .send({
      full_name: 'Owner B',
      email: restaurantBEmail,
      password: commonPassword,
      phone: '+201022220002',
      profile: {
        rest_title: 'Original Kitchen B',
        rest_description: 'Pizza and pasta',
        rest_image_url_mobile: 'https://example.com/rest-b.jpg',
        rest_address: '25 Sultan Hussein, Ismailia',
        longitude: '32.2800000',
        latitude: '30.6000000',
        opens_at: '10:00:00',
        closes_at: '02:00:00',
      },
    });
  assert.equal(regBRes.status, 201);
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

test('Feature 04 - Restaurant Profile Integration Tests', async (t) => {
  await t.test('Role access control and authentication', async () => {
    // Unauthenticated
    const unauthProfile = await api().get('/api/v1/restaurant/profile');
    assert.equal(unauthProfile.status, 401);

    const unauthDashboard = await api().get('/api/v1/restaurant/dashboard');
    assert.equal(unauthDashboard.status, 401);

    const unauthPatch = await api()
      .patch('/api/v1/restaurant/profile')
      .send({ rest_title: 'New Name' });
    assert.equal(unauthPatch.status, 401);

    // Customer role forbidden
    const customerProfile = await api()
      .get('/api/v1/restaurant/profile')
      .set('Authorization', bearer(customerToken));
    assert.equal(customerProfile.status, 403);
    assert.equal(customerProfile.body.message, 'Restaurant access required.');
    assert.equal(customerProfile.body.error.code, 'FORBIDDEN');

    const customerDashboard = await api()
      .get('/api/v1/restaurant/dashboard')
      .set('Authorization', bearer(customerToken));
    assert.equal(customerDashboard.status, 403);

    const customerPatch = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(customerToken))
      .send({ rest_title: 'Hacked' });
    assert.equal(customerPatch.status, 403);

    // Admin role forbidden
    const adminProfile = await api()
      .get('/api/v1/restaurant/profile')
      .set('Authorization', bearer(adminToken));
    assert.equal(adminProfile.status, 403);
  });

  await t.test('GET /restaurant/profile while Pending', async () => {
    const res = await api()
      .get('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.rest_id, restaurantAId);
    assert.equal(res.body.data.rest_title, 'Original Kitchen A');
    assert.equal(res.body.data.rest_description, 'Fast food and grills');
    assert.equal(
      res.body.data.rest_image_url_mobile,
      'https://example.com/rest-a.jpg',
    );
    assert.equal(res.body.data.rest_address, '10 Corniche Street, Ismailia');
    assert.equal(res.body.data.opens_at, '09:00:00');
    assert.equal(res.body.data.closes_at, '23:00:00');
    assert.equal(res.body.data.activation_status, 'Pending');
    assert.equal(res.body.data.is_active, true);
    assert.ok(res.body.data.created_at);
    assert.ok(res.body.data.updated_at);
  });

  await t.test('GET /restaurant/dashboard while Pending', async () => {
    const res = await api()
      .get('/api/v1/restaurant/dashboard')
      .set('Authorization', bearer(restaurantAToken));

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.rest_id, restaurantAId);
    assert.equal(res.body.data.activation_status, 'Pending');
    assert.equal(res.body.data.can_manage, false);
    assert.equal(
      res.body.data.message,
      'Your restaurant is waiting for Admin activation.',
    );
  });

  await t.test(
    'PATCH /restaurant/profile allows updating while Pending',
    async () => {
      const res = await api()
        .patch('/api/v1/restaurant/profile')
        .set('Authorization', bearer(restaurantAToken))
        .send({
          rest_title: 'Updated Kitchen A',
          rest_description: 'Best grilled burgers in town',
          rest_address: '15 Corniche Street, Ismailia',
          longitude: '32.2750000',
          latitude: '30.5950000',
          opens_at: '11:00:00',
          closes_at: '01:00:00',
          is_active: false,
        });

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.message, 'Restaurant profile updated.');
      assert.equal(res.body.data.rest_title, 'Updated Kitchen A');
      assert.equal(
        res.body.data.rest_description,
        'Best grilled burgers in town',
      );
      assert.equal(res.body.data.rest_address, '15 Corniche Street, Ismailia');
      assert.equal(res.body.data.longitude, '32.2750000');
      assert.equal(res.body.data.latitude, '30.5950000');
      assert.equal(res.body.data.opens_at, '11:00:00');
      assert.equal(res.body.data.closes_at, '01:00:00');
      assert.equal(res.body.data.is_active, false);
      assert.equal(res.body.data.activation_status, 'Pending'); // Unchanged

      // Verify persistence via GET
      const verify = await api()
        .get('/api/v1/restaurant/profile')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(verify.body.data.rest_title, 'Updated Kitchen A');
      assert.equal(verify.body.data.is_active, false);
    },
  );

  await t.test('PATCH /restaurant/profile validation rules', async () => {
    // 1. Same opening and closing time
    const sameHours = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken))
      .send({
        opens_at: '10:00:00',
        closes_at: '10:00:00',
      });
    assert.equal(sameHours.status, 422);
    assert.equal(
      sameHours.body.message,
      'Opening and closing times must differ.',
    );

    // 2. Partial hours update that matches existing
    // Current opens_at is 11:00:00. If we set closes_at to 11:00:00:
    const matchExisting = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken))
      .send({ closes_at: '11:00:00' });
    assert.equal(matchExisting.status, 422);

    // 3. Invalid latitude (> 90)
    const badLat = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken))
      .send({ latitude: '95.0000' });
    assert.equal(badLat.status, 422);

    // 4. Invalid longitude (> 180)
    const badLng = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken))
      .send({ longitude: '190.0000' });
    assert.equal(badLng.status, 422);

    // 5. Attempt to change activation_status in payload is rejected (not allowed field)
    const attemptActivationChange = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken))
      .send({ activation_status: 'Active' });
    assert.equal(attemptActivationChange.status, 422);
  });

  await t.test(
    'Admin activates restaurant; dashboard reflects Active and can_manage: true',
    async () => {
      // Admin activates Restaurant A
      const activateRes = await api()
        .patch(`/api/v1/admin/restaurants/${restaurantAId}/activation`)
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Active' });
      assert.equal(activateRes.status, 200);

      // GET /restaurant/dashboard
      const dashRes = await api()
        .get('/api/v1/restaurant/dashboard')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(dashRes.status, 200);
      assert.equal(dashRes.body.data.activation_status, 'Active');
      assert.equal(dashRes.body.data.can_manage, true);
      assert.equal(
        dashRes.body.data.message,
        'Your restaurant is active and ready to manage.',
      );

      // GET /restaurant/profile reflects Active
      const profRes = await api()
        .get('/api/v1/restaurant/profile')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(profRes.body.data.activation_status, 'Active');
    },
  );

  await t.test(
    'Admin suspends restaurant; dashboard reflects Suspended and can_manage: false',
    async () => {
      // Admin suspends Restaurant A
      const suspendRes = await api()
        .patch(`/api/v1/admin/restaurants/${restaurantAId}/activation`)
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Suspended' });
      assert.equal(suspendRes.status, 200);

      // GET /restaurant/dashboard
      const dashRes = await api()
        .get('/api/v1/restaurant/dashboard')
        .set('Authorization', bearer(restaurantAToken));
      assert.equal(dashRes.status, 200);
      assert.equal(dashRes.body.data.activation_status, 'Suspended');
      assert.equal(dashRes.body.data.can_manage, false);
      assert.equal(
        dashRes.body.data.message,
        'Your restaurant is suspended by Admin.',
      );

      // Profile can still be updated while Suspended (e.g. fixing info)
      const patchRes = await api()
        .patch('/api/v1/restaurant/profile')
        .set('Authorization', bearer(restaurantAToken))
        .send({ rest_description: 'Fixing description while suspended' });
      assert.equal(patchRes.status, 200);
      assert.equal(
        patchRes.body.data.rest_description,
        'Fixing description while suspended',
      );
    },
  );

  await t.test(
    'Owner account disabled blocks access via AccessGuard with 403',
    async () => {
      // Reactivate restaurant profile first
      await api()
        .patch(`/api/v1/admin/restaurants/${restaurantAId}/activation`)
        .set('Authorization', bearer(adminToken))
        .send({ activation_status: 'Active' });

      // Find user_id for Restaurant A and deactivate account
      const userRow = await db.query(
        `SELECT user_id FROM restaurant_profiles WHERE rest_id = $1`,
        [restaurantAId],
      );
      const userId = userRow[0].user_id;

      try {
        await db.query(
          `UPDATE users SET is_active = false WHERE user_id = $1`,
          [userId],
        );

        const dashRes = await api()
          .get('/api/v1/restaurant/dashboard')
          .set('Authorization', bearer(restaurantAToken));
        assert.equal(dashRes.status, 403);
        assert.equal(dashRes.body.message, 'This account is inactive.');
        assert.equal(dashRes.body.error.code, 'FORBIDDEN');
      } finally {
        // Restore user active state
        await db.query(`UPDATE users SET is_active = true WHERE user_id = $1`, [
          userId,
        ]);
      }
    },
  );

  await t.test('Profile isolation between restaurants', async () => {
    // Restaurant B reads own profile
    const profB = await api()
      .get('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantBToken));
    assert.equal(profB.status, 200);
    assert.equal(profB.body.data.rest_id, restaurantBId);
    assert.equal(profB.body.data.rest_title, 'Original Kitchen B');

    // Restaurant B updates its profile
    const patchB = await api()
      .patch('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantBToken))
      .send({ rest_title: 'Updated Kitchen B' });
    assert.equal(patchB.status, 200);
    assert.equal(patchB.body.data.rest_title, 'Updated Kitchen B');

    // Verify Restaurant A was untouched
    const profA = await api()
      .get('/api/v1/restaurant/profile')
      .set('Authorization', bearer(restaurantAToken));
    assert.equal(profA.body.data.rest_id, restaurantAId);
    assert.equal(profA.body.data.rest_title, 'Updated Kitchen A');
  });
});
