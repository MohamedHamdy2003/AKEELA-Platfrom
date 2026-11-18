import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment';
import { databaseOptions } from '../database/database.options';
import { AdminSetupError, ensureAdmin } from './admin-bootstrap';

loadEnv({ quiet: true });
async function main(): Promise<void> {
  let db: DataSource | undefined;
  try {
    const settings = validateEnvironment(process.env);
    db = new DataSource(databaseOptions(settings));
    await db.initialize();
    const result = await ensureAdmin(db, process.env);
    console.log(
      result === 'existing'
        ? 'Admin already exists; its account was left unchanged.'
        : 'Admin account created. Email verification follows ADMIN_VERIFIED.',
    );
  } catch (error) {
    console.error(
      error instanceof AdminSetupError
        ? error.message
        : 'Admin setup failed. Check configuration, database and migrations.',
    );
    process.exitCode = 1;
  } finally {
    if (db?.isInitialized) await db.destroy();
  }
}
void main();
