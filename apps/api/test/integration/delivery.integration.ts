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
let app: INestApplication;
let db: DataSource;
const tokens: string[] = [];
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
    'TRUNCATE device_tokens, order_item_addons, order_items, orders, cart_item_addons, cart_items, carts, delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );
  const hash = await app.get(AuthCryptoService).hashPassword('TestPassword123');
  for (const index of [1, 2, 3]) {
    const role = index === 3 ? 'Customer' : 'Delivery_Company';
    const email = `delivery-${index}-${randomUUID()}@example.com`;
    const [user] = await db.query(
      'INSERT INTO users(full_name,email,password_hash,phone_number,role,email_verified_at) VALUES($1,$2,$3,$4,$5,now()) RETURNING user_id',
      ['Test User', email, hash, `+20100000000${index}`, role],
    );
    if (role === 'Customer')
      await db.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [
        user.user_id,
      ]);
    else
      await db.query(
        'INSERT INTO delivery_company_profiles(user_id,company_name,company_phone,company_address) VALUES($1,$2,$3,$4)',
        [user.user_id, 'Delivery ' + index, '+201000000010', 'Test address'],
      );
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'TestPassword123' })
      .expect(200);
    tokens.push(login.body.data.tokens.access_token);
  }
});
after(async () => {
  if (app) await app.close();
});
test('company profile and drivers enforce role, ownership, validation and persistence', async () => {
  const api = () => request(app.getHttpServer());
  const auth = (index: number) => `Bearer ${tokens[index]}`;
  const profile = '/api/v1/delivery-company/profile';
  const drivers = '/api/v1/delivery-company/drivers';
  await api().get(profile).expect(401);
  await api().get(profile).set('Authorization', auth(2)).expect(403);
  const own = await api()
    .get(profile)
    .set('Authorization', auth(0))
    .expect(200);
  assert.equal(own.body.data.profile_role, undefined);
  await api()
    .patch(profile)
    .set('Authorization', auth(0))
    .send({ user_id: '2' })
    .expect(422);
  await api()
    .patch(profile)
    .set('Authorization', auth(0))
    .send({ company_name: null })
    .expect(422);
  await api()
    .patch(profile)
    .set('Authorization', auth(0))
    .send({ company_email: null, is_active: false })
    .expect(409);
  // The current single-company service cannot be disabled through the API.
  await api()
    .patch(profile)
    .set('Authorization', auth(0))
    .send({ is_active: true })
    .expect(200);
  await api()
    .post(drivers)
    .set('Authorization', auth(0))
    .send({ driver_name: 'Driver', driver_phone: 'bad' })
    .expect(422);
  const created = await api()
    .post(drivers)
    .set('Authorization', auth(0))
    .send({
      driver_name: 'Driver',
      driver_phone: '+201111111111',
      driver_email: 'driver@example.com',
    })
    .expect(201);
  const id = created.body.data.driver_id;
  assert.equal(typeof id, 'string');
  await api()
    .patch(`${drivers}/${id}`)
    .set('Authorization', auth(1))
    .send({ is_active: false })
    .expect(404);
  await api()
    .patch(`${drivers}/${id}`)
    .set('Authorization', auth(0))
    .send({ company_id: '2' })
    .expect(422);
  await api()
    .patch(`${drivers}/not-an-id`)
    .set('Authorization', auth(0))
    .send({ is_active: false })
    .expect(422);
  await api()
    .patch(`${drivers}/${id}`)
    .set('Authorization', auth(0))
    .send({ driver_email: null, is_active: false })
    .expect(200);
  const listed = await api()
    .get(drivers + '?is_active=false&per_page=1')
    .set('Authorization', auth(0))
    .expect(200);
  assert.equal(listed.body.meta.total, 1);
  assert.equal(listed.body.data[0].driver_email, null);
  const other = await api()
    .get(drivers)
    .set('Authorization', auth(1))
    .expect(200);
  assert.equal(other.body.meta.total, 0);
  await api()
    .get(drivers + '?is_active=bad')
    .set('Authorization', auth(0))
    .expect(422);
  await db.query('UPDATE users SET is_active=false WHERE user_id=$1', [
    own.body.data.user_id,
  ]);
  await api().get(drivers).set('Authorization', auth(0)).expect(403);
});
