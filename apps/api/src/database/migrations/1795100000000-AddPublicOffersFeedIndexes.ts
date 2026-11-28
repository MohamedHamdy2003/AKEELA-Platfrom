import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPublicOffersFeedIndexes1795100000000 implements MigrationInterface {
  name = 'AddPublicOffersFeedIndexes1795100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_order_items_offer_order
        ON order_items (offer_id, order_id)
        WHERE offer_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS ix_offers_public_active_window
        ON offers (starts_at, expires_at, rest_id)
        WHERE is_active = true;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_offers_public_active_window;
      DROP INDEX IF EXISTS ix_order_items_offer_order;
    `);
  }
}
