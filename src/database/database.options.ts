import { join } from 'node:path';
import { DataSourceOptions } from 'typeorm';
import { Environment } from '../config/environment';

export function databaseOptions(config: Environment): DataSourceOptions {
  const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
  return {
    type: 'postgres',
    url: config.DATABASE_URL,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: true } : false,
    entities: [join(__dirname, '..', 'modules', '**', `*.entity.${extension}`)],
    migrations: [join(__dirname, 'migrations', `*.${extension}`)],
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    logging: false,
    invalidWhereValuesBehavior: { null: 'throw', undefined: 'throw' },
  };
}
