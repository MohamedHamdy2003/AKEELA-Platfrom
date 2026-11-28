import { MigrationInterface, QueryRunner } from 'typeorm';

export class OptimizeOrderAndCatalogIndexes1795200000000 implements MigrationInterface {
  name = 'OptimizeOrderAndCatalogIndexes1795200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_orders_rest_created_id
        ON orders (rest_id, created_at, order_id);

      CREATE INDEX IF NOT EXISTS ix_orders_company_created_id
        ON orders (company_id, created_at, order_id)
        WHERE company_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS ix_offers_active_expires
        ON offers (expires_at)
        WHERE is_active = true;

      DROP INDEX IF EXISTS ix_categories_rest_id;
      DROP INDEX IF EXISTS ix_categories_rest_display;
      DROP INDEX IF EXISTS ix_products_rest_id;
      DROP INDEX IF EXISTS ix_addons_rest_id;
      DROP INDEX IF EXISTS ix_offers_rest_id;
      DROP INDEX IF EXISTS uq_order_items_rest_item_product;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_order_items_rest_item_product
        ON order_items (rest_id, order_item_id, prod_id);
      CREATE INDEX IF NOT EXISTS ix_offers_rest_id
        ON offers (rest_id);
      CREATE INDEX IF NOT EXISTS ix_addons_rest_id
        ON addons (rest_id);
      CREATE INDEX IF NOT EXISTS ix_products_rest_id
        ON products (rest_id);
      CREATE INDEX IF NOT EXISTS ix_categories_rest_display
        ON categories (rest_id, display_order);
      CREATE INDEX IF NOT EXISTS ix_categories_rest_id
        ON categories (rest_id);

      DROP INDEX IF EXISTS ix_offers_active_expires;
      DROP INDEX IF EXISTS ix_orders_company_created_id;
      DROP INDEX IF EXISTS ix_orders_rest_created_id;
    `);
  }
}
