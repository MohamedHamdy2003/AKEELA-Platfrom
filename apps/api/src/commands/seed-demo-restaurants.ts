import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rmdir, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { DataSource, EntityManager } from 'typeorm';
import { Environment, validateEnvironment } from '../config/environment';
import { databaseOptions } from '../database/database.options';
import { AuthCryptoService } from '../modules/auth/auth-crypto.service';
import { RestaurantProfile } from '../modules/restaurants/entities/restaurant-profile.entity';
import { User } from '../modules/users/entities/user.entity';
import { demoRestaurants } from './demo-restaurants';

class DemoSetupError extends Error {}

const runFile = promisify(execFile);

function localSettings(): Environment {
  const settings = validateEnvironment(process.env);
  const target = new URL(settings.DATABASE_URL);
  if (
    settings.NODE_ENV !== 'development' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.pathname !== '/akeela'
  ) {
    throw new DemoSetupError(
      'This command requires the local development database named akeela.',
    );
  }
  return settings;
}

async function seedRestaurants(
  manager: EntityManager,
  crypto: AuthCryptoService,
): Promise<Map<string, string>> {
  const users = manager.getRepository(User);
  const restaurants = manager.getRepository(RestaurantProfile);
  const passwords = new Map<string, string>();
  // Serialize repeated runs of this command within the same database.
  await manager.query('SELECT pg_advisory_xact_lock(1794520001)');
  for (const [index, fixture] of demoRestaurants.entries()) {
    const email = `${fixture.slug}@restaurants.akeela.test`;
    const phone = `+1202555${String(101 + index).padStart(4, '0')}`;
    const existing = await users.findOneBy({ email });
    if (existing) {
      const profile = await restaurants.findOneBy({
        user_id: existing.user_id,
      });
      if (
        existing.role !== 'Restaurant' ||
        existing.phone_number !== phone ||
        profile?.rest_title !== fixture.title
      ) {
        throw new DemoSetupError(
          'A demo login conflicts with an existing account.',
        );
      }
      continue;
    }
    if (
      (await users.existsBy({ phone_number: phone })) ||
      (await restaurants.existsBy({ rest_title: fixture.title }))
    ) {
      throw new DemoSetupError(
        'A demo phone number or restaurant name is already in use.',
      );
    }
    const password = `Demo8!${randomBytes(24).toString('base64url')}`;
    const owner = await users.save(
      users.create({
        full_name: `حساب تجريبي - ${fixture.title}`,
        email,
        phone_number: phone,
        password_hash: await crypto.hashPassword(password),
        role: 'Restaurant',
        is_active: true,
        email_verified_at: new Date(),
      }),
    );
    await restaurants.save(
      restaurants.create({
        user_id: owner.user_id,
        rest_title: fixture.title,
        rest_description: fixture.description,
        rest_address: fixture.address,
        latitude: fixture.latitude,
        longitude: fixture.longitude,
        opens_at: fixture.opensAt,
        closes_at: fixture.closesAt,
        activation_status: 'Active',
        is_active: true,
      }),
    );
    passwords.set(email, password);
  }
  return passwords;
}

function csvCell(value: string): string {
  const safe = /^\s*[=+@-]|^[\t\r\n]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

async function accountReport(
  manager: EntityManager,
  passwords: ReadonlyMap<string, string>,
): Promise<{ csv: string; count: number }> {
  const accounts = await manager.getRepository(User).find({
    select: {
      user_id: true,
      role: true,
      email: true,
      is_active: true,
      email_verified_at: true,
    },
    order: { role: 'ASC', user_id: 'ASC' },
  });
  const rows = [
    [
      'role',
      'email',
      'password',
      'password_status',
      'active',
      'email_verified',
    ],
  ];
  for (const account of accounts) {
    const password = passwords.get(account.email);
    rows.push([
      account.role,
      account.email,
      password ?? '',
      password ? 'generated_dev_password' : 'stored_as_hash',
      String(account.is_active),
      String(account.email_verified_at !== null),
    ]);
  }
  return {
    csv:
      '\uFEFF' +
      rows.map((row) => row.map(csvCell).join(',')).join('\r\n') +
      '\r\n',
    count: accounts.length,
  };
}

async function restrictWindowsReportFolder(folder: string): Promise<void> {
  if (process.platform !== 'win32') return;
  const { stdout } = await runFile('whoami.exe', [
    '/user',
    '/fo',
    'csv',
    '/nh',
  ]);
  const sid = /"((?:S-\d+)(?:-\d+)+)"\s*$/u.exec(stdout)?.[1];
  if (!sid)
    throw new DemoSetupError('Could not identify the Windows report owner.');
  await runFile('icacls.exe', [
    folder,
    '/inheritance:r',
    '/grant:r',
    `*${sid}:(OI)(CI)F`,
  ]);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--report-only')) {
    throw new DemoSetupError(
      'Usage: npm run seed:demo-restaurants [-- --report-only]',
    );
  }
  loadEnv({ quiet: true });
  const settings = localSettings();
  const db = new DataSource(databaseOptions(settings));
  const crypto = new AuthCryptoService(
    new ConfigService<Environment, true>(settings),
  );
  const root = join(
    process.env.LOCALAPPDATA || homedir(),
    'AKEELA',
    'local-reports',
  );
  await mkdir(root, { recursive: true, mode: 0o700 });
  const folder = await mkdtemp(join(root, 'accounts-'));
  const path = join(folder, 'accounts.csv');

  try {
    await restrictWindowsReportFolder(folder);
    await db.initialize();
    const result = await db.transaction(async (manager) => {
      const passwords =
        args.length === 0
          ? await seedRestaurants(manager, crypto)
          : new Map<string, string>();
      const report = await accountReport(manager, passwords);
      await writeFile(path, report.csv, { flag: 'wx', mode: 0o600 });
      return { created: passwords.size, accounts: report.count };
    });
    console.log(
      `Created ${result.created} demo restaurants. Exported ${result.accounts} local accounts to ${path}`,
    );
  } catch (error) {
    await unlink(path).catch(() => undefined);
    await rmdir(folder).catch(() => undefined);
    throw error;
  } finally {
    if (db.isInitialized) await db.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof DemoSetupError
      ? error.message
      : 'Demo setup failed. Check the local database, migrations, and report directory.',
  );
  process.exitCode = 1;
});
