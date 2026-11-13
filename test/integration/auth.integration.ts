import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { config as loadEnv } from 'dotenv';
import request from 'supertest';
import { configureApplication } from '../../src/bootstrap';
import { OtpMailService } from '../../src/modules/auth/otp-mail.service';

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
const email = `customer-${randomUUID()}@example.com`;
const restaurantEmail = `restaurant-${randomUUID()}@example.com`;
const password = 'Initial test password!2026';
let userId: string;
let access: string;
let refresh: string;
let restaurantId: string;
let restaurantAccess: string;

async function otp(
  address: string,
  purpose: 'verify' | 'reset',
): Promise<string> {
  const response = await fetch(
    'http://localhost:18025/api/v1/messages?limit=200',
  );
  if (!response.ok) throw new Error('Local Mailpit is unavailable.');
  const data = (await response.json()) as {
    messages: { ID: string; Subject: string; To: { Address: string }[] }[];
  };
  const message = data.messages.find(
    (item) =>
      item.To.some((to) => to.Address === address) &&
      item.Subject.includes(purpose === 'verify' ? 'Verify' : 'Reset'),
  );
  if (!message) throw new Error('Expected local OTP email was not captured.');
  const body = (await (
    await fetch(`http://localhost:18025/api/v1/message/${message.ID}`)
  ).json()) as { Text: string };
  const code = body.Text.match(/code is (\d{6})/);
  if (!code?.[1]) throw new Error('OTP email body has an invalid format.');
  return code[1];
}
function api() {
  return request(app.getHttpServer());
}
function bearer(token: string) {
  return `Bearer ${token}`;
}
async function login(address = email, pw = password) {
  const response = await api()
    .post('/api/v1/auth/login')
    .send({ email: address, password: pw });
  assert.equal(response.status, 200);
  return response.body.data.tokens as {
    access_token: string;
    refresh_token: string;
  };
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
    'TRUNCATE delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );
});
after(async () => {
  if (app) await app.close();
});

test('Feature 01 — PostgreSQL, actual HTTP APIs, and local SMTP', async (t) => {
  await t.test(
    'strict input validation and atomic customer registration',
    async () => {
      assert.equal((await api().get('/api/v1/me')).status, 401);
      const malformed = await api()
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"password":"private-test-marker",');
      assert.equal(malformed.status, 400);
      assert.equal(
        JSON.stringify(malformed.body).includes('private-test-marker'),
        false,
      );
      const invalid = await api().post('/api/v1/auth/register').send({
        full_name: 'Ahmed',
        email,
        password,
        phone: '+201000000001',
        role: 'Admin',
      });
      assert.equal(invalid.status, 422);
      assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
      assert.equal(invalid.body.success, false);
      const response = await api().post('/api/v1/auth/register').send({
        full_name: ' Ahmed Ali ',
        email: email.toUpperCase(),
        password,
        phone: '+201000000001',
      });
      assert.equal(response.status, 201);
      assert.equal(response.body.data.email, email);
      assert.equal(response.body.data.full_name, 'Ahmed Ali');
      assert.equal(response.body.data.email_verified_at, null);
      assert.equal(response.body.data.role, 'Customer');
      assert.equal(response.body.data.tokens, undefined);
      assert.equal(typeof response.body.data.user_id, 'string');
      assert.equal(response.body.data.password_hash, undefined);
      assert.equal(response.body.data.profile.cus_avatar_url, null);
      userId = response.body.data.user_id;
      const [saved] = await db.query(
        'SELECT password_hash FROM users WHERE user_id=$1',
        [userId],
      );
      assert.ok(saved.password_hash.startsWith('scrypt$'));
      assert.notEqual(saved.password_hash, password);
      const [challenge] = await db.query(
        'SELECT otp_hash FROM auth_challenges WHERE user_id=$1',
        [userId],
      );
      assert.match(challenge.otp_hash, /^[a-f0-9]{64}$/);
      const before = (await db.query('SELECT count(*) FROM users'))[0].count;
      const duplicate = await api().post('/api/v1/auth/register').send({
        full_name: 'Duplicate',
        email: 'different@example.com',
        password,
        phone: '+201000000001',
      });
      assert.equal(duplicate.status, 409);
      assert.equal(
        (await db.query('SELECT count(*) FROM users'))[0].count,
        before,
      );
    },
  );
  await t.test(
    'unverified login blocked; resend cooldown and generic recovery response',
    async () => {
      const response = await api()
        .post('/api/v1/auth/login')
        .send({ email, password });
      assert.equal(response.status, 403);
      assert.equal(response.body.error.code, 'EMAIL_NOT_VERIFIED');
      const [before] = await db.query(
        'SELECT otp_hash FROM auth_challenges WHERE user_id=$1',
        [userId],
      );
      const resend = await api()
        .post('/api/v1/auth/resend-verification')
        .send({ email });
      const unknown = await api()
        .post('/api/v1/auth/resend-verification')
        .send({ email: 'missing@example.com' });
      assert.equal(resend.status, 200);
      assert.deepEqual(resend.body, unknown.body);
      assert.equal(
        (
          await db.query(
            'SELECT otp_hash FROM auth_challenges WHERE user_id=$1',
            [userId],
          )
        )[0].otp_hash,
        before.otp_hash,
      );
    },
  );
  await t.test(
    'failed OTP attempts persist and successful OTP is single-use',
    async () => {
      const code = await otp(email, 'verify');
      const wrong = code === '000000' ? '999999' : '000000';
      const bad = await api()
        .post('/api/v1/auth/verify-email')
        .send({ email, otp: wrong });
      assert.equal(bad.status, 400);
      assert.equal(
        (
          await db.query(
            'SELECT attempt_count FROM auth_challenges WHERE user_id=$1',
            [userId],
          )
        )[0].attempt_count,
        1,
      );
      const good = await api()
        .post('/api/v1/auth/verify-email')
        .send({ email, otp: code });
      assert.equal(good.status, 200);
      const reused = await api()
        .post('/api/v1/auth/verify-email')
        .send({ email, otp: code });
      assert.equal(reused.status, 400);
    },
  );
  await t.test(
    'JWT login, own profile update, allowlists and string IDs',
    async () => {
      const tokens = await login();
      access = tokens.access_token;
      refresh = tokens.refresh_token;
      const self = await api()
        .get('/api/v1/me')
        .set('Authorization', bearer(access));
      assert.equal(self.status, 200);
      assert.equal(self.body.data.user_id, userId);
      assert.equal(self.headers['cache-control'], 'no-store');
      const updated = await api()
        .patch('/api/v1/me')
        .set('Authorization', bearer(access))
        .send({
          full_name: 'Ahmed Updated',
          cus_avatar_url: 'https://example.com/images/avatar.png',
        });
      assert.equal(updated.status, 200);
      assert.equal(
        updated.body.data.profile.cus_avatar_url,
        'https://example.com/images/avatar.png',
      );
      const clear = await api()
        .patch('/api/v1/me')
        .set('Authorization', bearer(access))
        .send({ cus_avatar_url: null });
      assert.equal(clear.status, 200);
      const bypass = await api()
        .patch('/api/v1/me')
        .set('Authorization', bearer(access))
        .send({ role: 'Admin', email_verified_at: new Date().toISOString() });
      assert.equal(bypass.status, 422);
      const nullName = await api()
        .patch('/api/v1/me')
        .set('Authorization', bearer(access))
        .send({ full_name: null });
      assert.equal(nullName.status, 422);
      const invalid = await api()
        .get('/api/v1/me')
        .set('Authorization', 'Bearer invalid.token.value');
      assert.equal(invalid.status, 401);
    },
  );
  await t.test(
    'refresh token rotation accepts only one concurrent request',
    async () => {
      const outcomes = await Promise.all([
        api().post('/api/v1/auth/refresh').send({ refresh_token: refresh }),
        api().post('/api/v1/auth/refresh').send({ refresh_token: refresh }),
      ]);
      assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 401]);
      const good = outcomes.find((r) => r.status === 200)!;
      access = good.body.data.access_token;
      refresh = good.body.data.refresh_token;
      const [saved] = await db.query(
        'SELECT refresh_token_hash FROM auth_sessions WHERE user_id=$1 AND revoked_at IS NULL',
        [userId],
      );
      assert.notEqual(saved.refresh_token_hash, refresh);
      assert.match(saved.refresh_token_hash, /^[a-f0-9]{64}$/);
    },
  );
  await t.test(
    'logout revokes both current access and refresh tokens',
    async () => {
      const out = await api()
        .post('/api/v1/auth/logout')
        .set('Authorization', bearer(access));
      assert.equal(out.status, 200);
      assert.equal(
        (await api().get('/api/v1/me').set('Authorization', bearer(access)))
          .status,
        401,
      );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/refresh')
            .send({ refresh_token: refresh })
        ).status,
        401,
      );
    },
  );
  await t.test(
    'password change revokes every session and checks current password',
    async () => {
      const a = await login();
      const b = await login();
      const bad = await api()
        .patch('/api/v1/me/password')
        .set('Authorization', bearer(a.access_token))
        .send({
          current_password: 'incorrect password',
          new_password: 'Changed8',
        });
      assert.equal(bad.status, 401);
      const changed = await api()
        .patch('/api/v1/me/password')
        .set('Authorization', bearer(a.access_token))
        .send({
          current_password: password,
          new_password: 'Changed8',
        });
      assert.equal(changed.status, 200);
      for (const token of [a.access_token, b.access_token])
        assert.equal(
          (await api().get('/api/v1/me').set('Authorization', bearer(token)))
            .status,
          401,
        );
      assert.equal(
        (await api().post('/api/v1/auth/login').send({ email, password }))
          .status,
        401,
      );
      const fresh = await login(email, 'Changed8');
      access = fresh.access_token;
    },
  );
  await t.test(
    'email recovery code is purpose-bound, single-use, and revokes sessions',
    async () => {
      const requested = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email });
      const unknown = await api()
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-account@example.com' });
      assert.deepEqual(requested.body, unknown.body);
      const code = await otp(email, 'reset');
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/verify-email')
            .send({ email, otp: code })
        ).status,
        400,
      );
      const reset = await api()
        .post('/api/v1/auth/reset-password')
        .send({ email, otp: code, new_password: 'Reset123' });
      assert.equal(reset.status, 200);
      assert.equal(
        (await api().get('/api/v1/me').set('Authorization', bearer(access)))
          .status,
        401,
      );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/reset-password')
            .send({ email, otp: code, new_password: 'Another password!2026' })
        ).status,
        400,
      );
      await login(email, 'Reset123');
    },
  );
  await t.test(
    'restaurant registration starts Pending and cannot set activation',
    async () => {
      const body = {
        full_name: 'Restaurant Owner',
        email: restaurantEmail,
        password,
        phone: '+201000000010',
        profile: {
          rest_title: 'Test Kitchen',
          rest_address: '12 Main Street',
          longitude: '32.2723000',
          latitude: '30.5965000',
          opens_at: '10:00:00',
          closes_at: '02:00:00',
        },
      };
      const invalid = await api()
        .post('/api/v1/auth/register/restaurant')
        .send({
          ...body,
          profile: { ...body.profile, activation_status: 'Active' },
        });
      assert.equal(invalid.status, 422);
      const sameHours = await api()
        .post('/api/v1/auth/register/restaurant')
        .send({
          ...body,
          profile: { ...body.profile, closes_at: body.profile.opens_at },
        });
      assert.equal(sameHours.status, 422);
      const created = await api()
        .post('/api/v1/auth/register/restaurant')
        .send(body);
      assert.equal(created.status, 201);
      restaurantId = created.body.data.user_id;
      assert.equal(created.body.data.profile.activation_status, 'Pending');
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/verify-email')
            .send({
              email: restaurantEmail,
              otp: await otp(restaurantEmail, 'verify'),
            })
        ).status,
        200,
      );
      restaurantAccess = (await login(restaurantEmail)).access_token;
      const me = await api()
        .get('/api/v1/me')
        .set('Authorization', bearer(restaurantAccess));
      assert.equal(me.status, 200);
      assert.equal(me.body.data.profile.activation_status, 'Pending');
      const blocked = await api()
        .patch('/api/v1/me')
        .set('Authorization', bearer(restaurantAccess))
        .send({ full_name: 'Bypass' });
      assert.equal(blocked.status, 403);
      assert.equal(blocked.body.error.code, 'RESTAURANT_NOT_ACTIVE');
    },
  );
  await t.test(
    'activation is read from PostgreSQL on existing sessions; account disabling takes effect',
    async () => {
      await db.query(
        "UPDATE restaurant_profiles SET activation_status='Active' WHERE user_id=$1",
        [restaurantId],
      );
      assert.equal(
        (
          await api()
            .patch('/api/v1/me')
            .set('Authorization', bearer(restaurantAccess))
            .send({ full_name: 'Active Owner' })
        ).status,
        200,
      );
      await db.query(
        "UPDATE restaurant_profiles SET activation_status='Suspended' WHERE user_id=$1",
        [restaurantId],
      );
      assert.equal(
        (
          await api()
            .patch('/api/v1/me')
            .set('Authorization', bearer(restaurantAccess))
            .send({ full_name: 'Suspended Owner' })
        ).status,
        403,
      );
      await db.query('UPDATE users SET is_active=false WHERE user_id=$1', [
        restaurantId,
      ]);
      assert.equal(
        (
          await api()
            .get('/api/v1/me')
            .set('Authorization', bearer(restaurantAccess))
        ).status,
        403,
      );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/login')
            .send({ email: restaurantEmail, password })
        ).status,
        403,
      );
    },
  );
  await t.test(
    'OTP attempt cap, expiry, and resend invalidation are enforced in PostgreSQL',
    async () => {
      const address = `locked-${randomUUID()}@example.com`;
      const reg = await api().post('/api/v1/auth/register').send({
        full_name: 'Locked User',
        email: address,
        password,
        phone: '+201000000099',
      });
      assert.equal(reg.status, 201);
      const id = reg.body.data.user_id;
      const code = await otp(address, 'verify');
      const wrong = code === '000000' ? '999999' : '000000';
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await api()
              .post('/api/v1/auth/verify-email')
              .send({ email: address, otp: wrong })
          ).status,
          400,
        );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/verify-email')
            .send({ email: address, otp: code })
        ).status,
        400,
      );
      assert.equal(
        (
          await db.query(
            'SELECT attempt_count FROM auth_challenges WHERE user_id=$1',
            [id],
          )
        )[0].attempt_count,
        5,
      );
      await db.query(
        "UPDATE auth_challenges SET next_send_at=now()-interval '1 second' WHERE user_id=$1",
        [id],
      );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/resend-verification')
            .send({ email: address })
        ).status,
        200,
      );
      const newCode = await otp(address, 'verify');
      if (newCode !== code)
        assert.equal(
          (
            await api()
              .post('/api/v1/auth/verify-email')
              .send({ email: address, otp: code })
          ).status,
          400,
        );
      await db.query(
        "UPDATE auth_challenges SET created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' WHERE user_id=$1",
        [id],
      );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/verify-email')
            .send({ email: address, otp: newCode })
        ).status,
        400,
      );
    },
  );
  await t.test(
    'database constraints prevent mismatched profiles and invalid coordinates; unknown APIs stay absent',
    async () => {
      await assert.rejects(
        db.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [
          restaurantId,
        ]),
      );
      await assert.rejects(
        db.query(
          'UPDATE restaurant_profiles SET longitude=181 WHERE user_id=$1',
          [restaurantId],
        ),
      );
      await assert.rejects(
        db.query("UPDATE users SET role='Admin' WHERE user_id=$1", [userId]),
      );
      await assert.rejects(
        db.query('UPDATE users SET email=upper(email) WHERE user_id=$1', [
          userId,
        ]),
      );
      const unknown = await api().get('/api/v1/customer/orders');
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.error.code, 'NOT_FOUND');
    },
  );
  await t.test(
    'SMTP failure does not roll back saved registration or expose internal errors',
    async () => {
      const mail = app.get(OtpMailService);
      const original = mail.send.bind(mail);
      mail.send = async () => false;
      try {
        const created = await api()
          .post('/api/v1/auth/register')
          .send({
            full_name: 'Mail Failure',
            email: `failure-${randomUUID()}@example.com`,
            password,
            phone: '+201000000098',
          });
        assert.equal(created.status, 201);
        assert.ok(created.body.data.user_id);
        assert.equal(created.body.data.email_verified_at, null);
        assert.equal(
          (
            await db.query(
              'SELECT count(*) FROM auth_challenges WHERE user_id=$1',
              [created.body.data.user_id],
            )
          )[0].count,
          '1',
        );
      } finally {
        mail.send = original;
      }
    },
  );

  await t.test(
    'access JWT expiry, issuer, audience, signature, and session expiry are checked',
    async () => {
      const tokens = await login(email, 'Reset123');
      const jwt = app.get(JwtService);
      const decoded = jwt.decode(tokens.access_token) as {
        sub: string;
        sid: string;
      };
      const body = { sub: decoded.sub, sid: decoded.sid };
      const options = {
        secret: process.env.JWT_SECRET,
        issuer: 'akeela-api',
        audience: 'akeela-clients',
        expiresIn: 900,
      };
      for (const change of [
        { expiresIn: -1 },
        { issuer: 'wrong-issuer' },
        { audience: 'wrong-audience' },
        { secret: 'different-test-signing-secret-0123456789012345' },
      ]) {
        const invalid = await jwt.signAsync(body, { ...options, ...change });
        assert.equal(
          (await api().get('/api/v1/me').set('Authorization', bearer(invalid)))
            .status,
          401,
        );
      }
      await db.query(
        "UPDATE auth_sessions SET created_at=now()-interval '2 minutes', expires_at=now()-interval '1 minute' WHERE session_id=$1",
        [decoded.sid],
      );
      assert.equal(
        (
          await api()
            .get('/api/v1/me')
            .set('Authorization', bearer(tokens.access_token))
        ).status,
        401,
      );
      assert.equal(
        (
          await api()
            .post('/api/v1/auth/refresh')
            .send({ refresh_token: tokens.refresh_token })
        ).status,
        401,
      );
    },
  );
  await t.test('verification is atomic under concurrent requests', async () => {
    const address = `concurrent-${randomUUID()}@example.com`;
    assert.equal(
      (
        await api().post('/api/v1/auth/register').send({
          full_name: 'Concurrent User',
          email: address,
          password,
          phone: '+201000000088',
        })
      ).status,
      201,
    );
    const code = await otp(address, 'verify');
    const outcomes = await Promise.all([
      api()
        .post('/api/v1/auth/verify-email')
        .send({ email: address, otp: code }),
      api()
        .post('/api/v1/auth/verify-email')
        .send({ email: address, otp: code }),
    ]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 400]);
  });
  await t.test(
    'Admin/company login profiles work, and BIGINT IDs retain full precision',
    async () => {
      const [existing] = await db.query(
        'SELECT password_hash FROM users WHERE user_id=$1',
        [userId],
      );
      for (const [id, role, address, phone] of [
        [
          '9007199254740993',
          'Admin',
          'admin-fixture@example.com',
          '+201000000070',
        ],
        [
          '9007199254740994',
          'Delivery_Company',
          'company-fixture@example.com',
          '+201000000071',
        ],
      ]) {
        await db.query(
          'INSERT INTO users(user_id,full_name,email,phone_number,password_hash,role,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())',
          [id, 'Test Fixture', address, phone, existing.password_hash, role],
        );
        if (role === 'Admin')
          await db.query('INSERT INTO admin_profiles(user_id) VALUES($1)', [
            id,
          ]);
        else
          await db.query(
            "INSERT INTO delivery_company_profiles(user_id,company_name,company_phone,company_address) VALUES($1,'Test Company',$2,'Test Address')",
            [id, phone],
          );
        const tokens = await login(address, 'Reset123');
        const me = await api()
          .get('/api/v1/me')
          .set('Authorization', bearer(tokens.access_token));
        assert.equal(me.status, 200);
        assert.equal(me.body.data.user_id, id);
        assert.equal(me.body.data.profile.profile_role, role);
        assert.equal(
          (
            await api()
              .patch('/api/v1/me')
              .set('Authorization', bearer(tokens.access_token))
              .send({ cus_avatar_url: 'https://example.com/avatar.jpg' })
          ).status,
          422,
        );
      }
    },
  );
  await t.test(
    'initial migration rolls back and reapplies in the dedicated test database',
    async () => {
      const before = await db.driver.createSchemaBuilder().log();
      assert.equal(
        before.upQueries.length,
        0,
        'Entity metadata and reviewed migration must agree.',
      );
      while (
        (await db.query('SELECT count(*) FROM migrations'))[0].count !== '0'
      )
        await db.undoLastMigration({ transaction: 'all' });
      assert.equal(
        (await db.query("SELECT to_regclass('public.users') AS name"))[0].name,
        null,
      );
      await db.runMigrations({ transaction: 'all' });
      const after = await db.driver.createSchemaBuilder().log();
      assert.equal(after.upQueries.length, 0);
      assert.equal(
        (await db.query('SELECT count(*) FROM users'))[0].count,
        '0',
      );
    },
  );
});
