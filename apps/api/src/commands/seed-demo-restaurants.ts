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
import { Addon } from '../modules/catalog/entities/addon.entity';
import { Category } from '../modules/catalog/entities/category.entity';
import { Offer } from '../modules/catalog/entities/offer.entity';
import { ProductAddon } from '../modules/catalog/entities/product-addon.entity';
import { Product } from '../modules/catalog/entities/product.entity';
import { RestaurantProfile } from '../modules/restaurants/entities/restaurant-profile.entity';
import { User } from '../modules/users/entities/user.entity';
import { demoRestaurants, DemoRestaurantFixture } from './demo-restaurants';

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

async function seedRestaurantCatalog(
  manager: EntityManager,
  restId: string,
  fixture: DemoRestaurantFixture,
): Promise<void> {
  const categoriesRepo = manager.getRepository(Category);
  const productsRepo = manager.getRepository(Product);
  const addonsRepo = manager.getRepository(Addon);
  const linksRepo = manager.getRepository(ProductAddon);
  const offersRepo = manager.getRepository(Offer);

  const linkableProductIds: string[] = [];
  const existingCats = await categoriesRepo.findBy({ rest_id: restId });
  let nextOrder =
    existingCats.reduce((max, c) => Math.max(max, c.display_order), 0) + 1;

  for (const catSpec of fixture.categories) {
    let category = await categoriesRepo.findOneBy({
      rest_id: restId,
      cat_title: catSpec.title,
    });
    if (!category) {
      category = await categoriesRepo.save(
        categoriesRepo.create({
          rest_id: restId,
          cat_title: catSpec.title,
          display_order: nextOrder,
          is_active: true,
        }),
      );
      nextOrder += 1;
    }
    for (const prodSpec of catSpec.products) {
      let product = await productsRepo.findOneBy({
        rest_id: restId,
        prod_name: prodSpec.name,
      });
      if (!product) {
        product = await productsRepo.save(
          productsRepo.create({
            rest_id: restId,
            cat_id: category.cat_id,
            prod_name: prodSpec.name,
            prod_description: prodSpec.description,
            price: prodSpec.price,
            is_active: true,
          }),
        );
      }
      if (catSpec.linkAddons) {
        linkableProductIds.push(product.prod_id);
      }
    }
  }

  for (const addonSpec of fixture.addons) {
    let addon = await addonsRepo.findOneBy({
      rest_id: restId,
      addon_name: addonSpec.name,
    });
    if (!addon) {
      addon = await addonsRepo.save(
        addonsRepo.create({
          rest_id: restId,
          addon_name: addonSpec.name,
          addon_price: addonSpec.price,
          is_active: true,
        }),
      );
    }
    for (const prodId of linkableProductIds) {
      const exists = await linksRepo.existsBy({
        rest_id: restId,
        prod_id: prodId,
        addon_id: addon.addon_id,
      });
      if (!exists) {
        await linksRepo.save(
          linksRepo.create({
            rest_id: restId,
            prod_id: prodId,
            addon_id: addon.addon_id,
            is_active: true,
          }),
        );
      }
    }
  }

  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  for (const offerSpec of fixture.offers) {
    const exists = await offersRepo.existsBy({
      rest_id: restId,
      offer_title: offerSpec.title,
    });
    if (!exists) {
      const expiresAt = new Date(
        startOfToday.getTime() +
          offerSpec.durationDays * 24 * 60 * 60 * 1000 -
          1000,
      );
      await offersRepo.save(
        offersRepo.create({
          rest_id: restId,
          offer_title: offerSpec.title,
          offer_description: offerSpec.description,
          initial_price: offerSpec.initialPrice,
          real_price: offerSpec.realPrice,
          is_active: true,
          starts_at: startOfToday,
          expires_at: expiresAt,
        }),
      );
    }
  }
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
      await seedRestaurantCatalog(manager, profile.rest_id, fixture);
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
        full_name: fixture.ownerName,
        email,
        phone_number: phone,
        password_hash: await crypto.hashPassword(password),
        role: 'Restaurant',
        is_active: true,
        email_verified_at: new Date(),
      }),
    );
    const createdProfile = await restaurants.save(
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
    await seedRestaurantCatalog(manager, createdProfile.rest_id, fixture);
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
  if (
    args.length > 1 ||
    (args.length === 1 &&
      !['--report-only', '--refresh-demo-names'].includes(args[0]!))
  ) {
    throw new DemoSetupError(
      'Usage: npm run seed:demo-restaurants [-- --report-only|--refresh-demo-names]',
    );
  }
  loadEnv({ quiet: true });
  const settings = localSettings();
  const db = new DataSource(databaseOptions(settings));
  if (args[0] === '--refresh-demo-names') {
    try {
      await db.initialize();
      const changed = await db.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(1794520001)');
        let count = 0;
        for (const fixture of demoRestaurants) {
          const result = await manager.getRepository(User).update(
            {
              email: `${fixture.slug}@restaurants.akeela.test`,
              role: 'Restaurant',
              full_name: `حساب تجريبي - ${fixture.title}`,
            },
            { full_name: fixture.ownerName },
          );
          count += result.affected ?? 0;
        }
        return count;
      });
      console.log(
        `Updated ${changed} local demo owner names. Login details and custom names are unchanged.`,
      );
    } finally {
      if (db.isInitialized) await db.destroy();
    }
    return;
  }
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
