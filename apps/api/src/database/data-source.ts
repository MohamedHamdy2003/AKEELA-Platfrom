import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment';
import { databaseOptions } from './database.options';

config({ quiet: true });

const base = databaseOptions(validateEnvironment(process.env));

export default new DataSource({
  ...base,
  extra: {
    ...(base.extra ?? {}),
    statement_timeout: 0,
    lock_timeout: 10000,
  },
});
