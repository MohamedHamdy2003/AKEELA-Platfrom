import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { before, after, test } from 'node:test';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  ensureAdmin,
  AdminSetupError,
} from '../../src/commands/admin-bootstrap';
import { databaseOptions } from '../../src/database/database.options';
import { validateEnvironment } from '../../src/config/environment';
loadEnv({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL is required.');
const parsed = new URL(testUrl);
if (
  !parsed.pathname.endsWith('_test') ||
  !['localhost', '127.0.0.1'].includes(parsed.hostname)
)
  throw new Error('Use a dedicated local _test database.');
let db: DataSource;
const credentials = {
  ADMIN_EMAIL: 'bootstrap@example.com',
  ADMIN_PASSWORD: 'TestPassword123',
  ADMIN_FULL_NAME: 'Test Admin',
  ADMIN_PHONE: '+201111111111',
};
before(async () => {
  db = new DataSource(
    databaseOptions(
      validateEnvironment({
        DATABASE_URL: testUrl,
        JWT_SECRET: 'bootstrap-test-jwt-012345678901234567890',
        OTP_SECRET: 'bootstrap-test-otp-012345678901234567890',
        NODE_ENV: 'test',
      }),
    ),
  );
  await db.initialize();
  await db.runMigrations({ transaction: 'all' });
  await db.query(
    'TRUNCATE device_tokens, order_item_addons, order_items, orders, cart_item_addons, cart_items, carts, delivery_drivers, offers, product_addons, addons, products, categories, customer_addresses, auth_sessions, auth_challenges, admin_profiles, delivery_company_profiles, restaurant_profiles, customer_profiles, users RESTART IDENTITY',
  );
});
after(async () => {
  if (db?.isInitialized) await db.destroy();
});
test('Admin bootstrap is atomic, concurrent-safe and never resets an existing account', async () => {
  await assert.rejects(ensureAdmin(db, {}), AdminSetupError);
  assert.equal((await db.query('SELECT count(*) FROM users'))[0].count, '0');
  const result = await Promise.all([
    ensureAdmin(db, credentials),
    ensureAdmin(db, credentials),
    ensureAdmin(db, credentials),
  ]);
  assert.equal(result.filter((value) => value === 'created').length, 1);
  const [before] = await db.query(
    "SELECT user_id,password_hash,email,phone_number,email_verified_at FROM users WHERE role='Admin'",
  );
  assert.ok(before.email_verified_at);
  assert.equal(
    await ensureAdmin(db, {
      ...credentials,
      ADMIN_EMAIL: 'changed@example.com',
      ADMIN_PASSWORD: 'DifferentPassword123',
    }),
    'existing',
  );
  assert.equal(await ensureAdmin(db, {}), 'existing');
  const [after] = await db.query(
    "SELECT user_id,password_hash,email,phone_number,email_verified_at FROM users WHERE role='Admin'",
  );
  assert.deepEqual(after, before);
  assert.equal(
    (await db.query('SELECT count(*) FROM admin_profiles'))[0].count,
    '1',
  );
});
