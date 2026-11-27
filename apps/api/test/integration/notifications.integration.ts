import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { configureApplication } from '../../src/bootstrap';
import { AuthCryptoService } from '../../src/modules/auth/auth-crypto.service';

loadEnv({ quiet: true });
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('Set TEST_DATABASE_URL to a dedicated PostgreSQL test DB.');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_SSL = 'false';
process.env.JWT_SECRET = 'integration-test-jwt-secret-at-least-32-chars';
process.env.OTP_SECRET = 'integration-test-otp-secret-at-least-32-chars';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '11025';
process.env.SMTP_SECURE = 'false';
process.env.SMTP_REQUIRE_TLS = 'false';
process.env.SMTP_FROM = 'AKEELA <noreply@example.com>';
process.env.FCM_PROJECT_ID = '';
process.env.FCM_CLIENT_EMAIL = '';
process.env.FCM_PRIVATE_KEY = '';

let app: INestApplication;
let db: DataSource;
let adminToken: string;
let customerToken: string;
let customer2Token: string;
let customerUserId: string;

const commonPassword = 'TestPassword2026!';
const api = () => request(app.getHttpServer());
const bearer = (token: string) => `Bearer ${token}`;

async function loginUser(email: string) {
  const res = await api()
    .post('/api/v1/auth/login')
    .send({ email, password: commonPassword });
  assert.equal(res.status, 200);
  return res.body.data.tokens.access_token as string;
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
  const crypto = app.get(AuthCryptoService);
  await db.runMigrations({ transaction: 'all' });
  await db.query(
    'TRUNCATE device_tokens, order_item_addons, order_items, orders, cart_item_addons, cart_items, carts, delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );

  const hash = await crypto.hashPassword(commonPassword);
  const adminEmail = `admin-${randomUUID()}@example.com`;
  const [adminRow] = await db.query(
    `INSERT INTO users (full_name, email, phone_number, password_hash, role, is_active, email_verified_at)
     VALUES ($1, $2, $3, $4, 'Admin', true, NOW()) RETURNING user_id`,
    ['Admin User', adminEmail, '+201099990001', hash],
  );
  await db.query(`INSERT INTO admin_profiles (user_id) VALUES ($1)`, [
    adminRow.user_id,
  ]);
  adminToken = await loginUser(adminEmail);

  const c1Email = `c1-${randomUUID()}@example.com`;
  await api().post('/api/v1/auth/register').send({
    full_name: 'Customer One',
    email: c1Email,
    password: commonPassword,
    phone: '+201099990002',
  });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [c1Email],
  );
  const [c1Row] = await db.query(`SELECT user_id FROM users WHERE email = $1`, [
    c1Email,
  ]);
  customerUserId = c1Row.user_id;
  customerToken = await loginUser(c1Email);

  const c2Email = `c2-${randomUUID()}@example.com`;
  await api().post('/api/v1/auth/register').send({
    full_name: 'Customer Two',
    email: c2Email,
    password: commonPassword,
    phone: '+201099990003',
  });
  await db.query(
    `UPDATE users SET email_verified_at = NOW() WHERE email = $1`,
    [c2Email],
  );
  customer2Token = await loginUser(c2Email);
});

after(async () => {
  if (app) await app.close();
});

test('Feature 18 — Push Notifications (FCM device token lifecycle & Admin send)', async (t) => {
  const sharedDeviceToken =
    'fcm_shared_device_token_abcdefghijklmnopqrstuvwxyz_0123456789';
  let tokenId = '';

  await t.test(
    'PUT/GET /me/device-tokens registers, lists, and reassigns token across accounts',
    async () => {
      const reg1 = await api()
        .put('/api/v1/me/device-tokens')
        .set('Authorization', bearer(customerToken))
        .send({
          fcm_token: sharedDeviceToken,
          platform: 'android',
          device_label: 'Pixel 9',
        });
      assert.equal(reg1.status, 200);
      assert.equal(reg1.body.data.platform, 'android');
      assert.equal(reg1.body.data.device_label, 'Pixel 9');
      tokenId = reg1.body.data.token_id;

      const list1 = await api()
        .get('/api/v1/me/device-tokens')
        .set('Authorization', bearer(customerToken));
      assert.equal(list1.status, 200);
      assert.equal(list1.body.data.length, 1);

      // Re-register same physical FCM token under Customer Two -> reassigns ownership
      const reg2 = await api()
        .put('/api/v1/me/device-tokens')
        .set('Authorization', bearer(customer2Token))
        .send({
          fcm_token: sharedDeviceToken,
          platform: 'ios',
          device_label: 'iPhone 16',
        });
      assert.equal(reg2.status, 200);
      assert.equal(reg2.body.data.token_id, tokenId);
      assert.equal(reg2.body.data.platform, 'ios');

      const list1After = await api()
        .get('/api/v1/me/device-tokens')
        .set('Authorization', bearer(customerToken));
      assert.equal(list1After.body.data.length, 0);

      // Customer One cannot delete Customer Two's token
      const delForbidden = await api()
        .delete(`/api/v1/me/device-tokens/${tokenId}`)
        .set('Authorization', bearer(customerToken));
      assert.equal(delForbidden.status, 404);

      // Customer Two deletes own token
      const delOk = await api()
        .delete(`/api/v1/me/device-tokens/${tokenId}`)
        .set('Authorization', bearer(customer2Token));
      assert.equal(delOk.status, 200);
    },
  );

  await t.test(
    'POST /admin/notifications/send enforces Admin role, validates target, and returns dispatch summary',
    async () => {
      // Register a fresh token for Customer One
      await api()
        .put('/api/v1/me/device-tokens')
        .set('Authorization', bearer(customerToken))
        .send({
          fcm_token: 'fcm_customer_one_live_token_0123456789abcdefghijk',
          platform: 'android',
        })
        .expect(200);

      // Customer cannot call admin send
      await api()
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', bearer(customerToken))
        .send({ title: 'Hi', body: 'Blocked', role: 'Customer' })
        .expect(403);

      // Reject providing both user_id and role, or neither
      await api()
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', bearer(adminToken))
        .send({ title: 'Hi', body: 'Missing target' })
        .expect(422);

      await api()
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', bearer(adminToken))
        .send({
          title: 'Hi',
          body: 'Both targets',
          user_id: customerUserId,
          role: 'Customer',
        })
        .expect(422);

      // Targeted user dispatch (FCM runs cleanly in no-op mode without credentials)
      const resUser = await api()
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', bearer(adminToken))
        .send({
          title: 'إشعار تجريبي',
          body: 'أهلاً بك في أكيلة',
          user_id: customerUserId,
          data: { screen: 'home' },
        });
      assert.equal(resUser.status, 200);
      assert.equal(resUser.body.data.fcm_configured, false);
      assert.equal(resUser.body.data.targeted_users, 1);
      assert.equal(resUser.body.data.targeted_tokens, 1);

      // Logout revokes session -> token is immediately excluded from delivery!
      await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(customerToken))
        .expect(200);

      const resAfterLogout = await api()
        .post('/api/v1/admin/notifications/send')
        .set('Authorization', bearer(adminToken))
        .send({
          title: 'بعد الخروج',
          body: 'لا يجب الإرسال لجلسة ملغاة',
          user_id: customerUserId,
        });
      assert.equal(resAfterLogout.status, 200);
      assert.equal(resAfterLogout.body.data.targeted_tokens, 0);
    },
  );
});
