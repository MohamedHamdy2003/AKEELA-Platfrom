import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSessionRevokedAtIndex1794800000000 implements MigrationInterface {
  name = 'AddSessionRevokedAtIndex1794800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_auth_sessions_revoked_at
        ON auth_sessions (revoked_at)
        WHERE revoked_at IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_auth_sessions_revoked_at;
    `);
  }
}
