/**
 * CLI command to create the first (and only) Admin account.
 *
 * Usage:
 *   npm run create:admin
 *
 * Required environment variables (set in .env or as shell variables):
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, ADMIN_PHONE
 *
 * The command creates the users row and admin_profiles row in one transaction,
 * then prints a reminder to verify the email via OTP before the first login.
 * Run this once only; re-running when the email already exists will abort.
 */
import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { scrypt, randomBytes } from 'node:crypto';
import { validateEnvironment } from '../config/environment';
import { databaseOptions } from '../database/database.options';

loadEnv({ quiet: true });

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    scrypt(
      password,
      salt,
      64,
      { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 },
      (err, key) => {
        if (err) return reject(err);
        resolve(`scrypt$65536$8$2$${salt}$${key.toString('hex')}`);
      },
    );
  });
}

async function main(): Promise<void> {
  let settings: ReturnType<typeof validateEnvironment>;
  try {
    settings = validateEnvironment(process.env);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Invalid configuration.',
    );
    process.exitCode = 1;
    return;
  }

  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  const fullName = (process.env.ADMIN_FULL_NAME ?? '').trim();
  const phone = (process.env.ADMIN_PHONE ?? '').trim();

  if (!email || !password || !fullName || !phone) {
    console.error(
      'Set ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME, and ADMIN_PHONE before running this command.',
    );
    process.exitCode = 1;
    return;
  }
  if (password.length < 8 || password.length > 128) {
    console.error('ADMIN_PASSWORD must be 8–128 characters.');
    process.exitCode = 1;
    return;
  }
  if (!/(?=.*\p{L})(?=.*\p{Nd})/su.test(password)) {
    console.error(
      'ADMIN_PASSWORD must contain at least one letter and one digit.',
    );
    process.exitCode = 1;
    return;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    console.error(
      'ADMIN_PHONE must start with + and country code (8–15 digits total).',
    );
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);

  const ds = new DataSource(databaseOptions(settings));

  try {
    await ds.initialize();
  } catch {
    console.error('Could not connect to PostgreSQL. Check DATABASE_URL.');
    process.exitCode = 1;
    return;
  }

  try {
    await ds.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(1794520000)');
      const existing = await manager
        .createQueryBuilder()
        .select('u.user_id')
        .from('users', 'u')
        .where('u.email = :email', { email })
        .getRawOne<{ user_id: string }>();

      if (existing) {
        throw new Error(`An account with email ${email} already exists.`);
      }

      const adminCount = await manager
        .createQueryBuilder()
        .select('u.user_id')
        .from('users', 'u')
        .where("u.role = 'Admin'")
        .getCount();

      if (adminCount > 0) {
        throw new Error(
          'An Admin account already exists. This application supports only one Admin.',
        );
      }

      const verified = process.env.ADMIN_VERIFIED !== 'false';
      const result = await manager
        .createQueryBuilder()
        .insert()
        .into('users')
        .values({
          full_name: fullName,
          email,
          phone_number: phone,
          password_hash: passwordHash,
          role: 'Admin',
          is_active: true,
          email_verified_at: verified ? new Date() : null,
        })
        .returning('user_id')
        .execute();

      const userId: string = result.raw[0].user_id;

      await manager
        .createQueryBuilder()
        .insert()
        .into('admin_profiles')
        .values({ user_id: userId })
        .execute();
    });

    console.log(
      `Admin account created for ${email} with full access. You can log in immediately.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : 'Failed to create Admin account.',
    );
    process.exitCode = 1;
  } finally {
    await ds.destroy();
  }
}

void main();
