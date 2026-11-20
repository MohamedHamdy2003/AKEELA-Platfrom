import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1794600000000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1794600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_orders_status_created_id
        ON orders (status, created_at DESC, order_id DESC);

      CREATE INDEX IF NOT EXISTS ix_orders_created_id
        ON orders (created_at DESC, order_id DESC);

      CREATE INDEX IF NOT EXISTS ix_orders_company_status_created_id
        ON orders (company_id, status, created_at DESC, order_id DESC)
        WHERE company_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS ix_orders_picked_up_updated
        ON orders (updated_at)
        WHERE status = 'Picked_Up';

      CREATE INDEX IF NOT EXISTS ix_order_items_order_id
        ON order_items (order_id, order_item_id);

      CREATE INDEX IF NOT EXISTS ix_cart_items_cart_id
        ON cart_items (cart_id, cart_item_id);

      CREATE INDEX IF NOT EXISTS ix_users_role_active_created
        ON users (role, is_active, created_at DESC);

      CREATE INDEX IF NOT EXISTS ix_users_created_desc
        ON users (created_at DESC);

      CREATE INDEX IF NOT EXISTS ix_users_active_verified_restaurants
        ON users (user_id)
        WHERE role = 'Restaurant' AND is_active = true AND email_verified_at IS NOT NULL;

      CREATE INDEX IF NOT EXISTS ix_restaurant_public_active
        ON restaurant_profiles (activation_status, is_active, created_at DESC, rest_id DESC);

      CREATE INDEX IF NOT EXISTS ix_delivery_drivers_company_active_id
        ON delivery_drivers (company_id, is_active, driver_id DESC);

      CREATE INDEX IF NOT EXISTS ix_products_rest_active_created
        ON products (rest_id, is_active, created_at DESC, prod_id DESC);

      CREATE INDEX IF NOT EXISTS ix_auth_sessions_expires_at
        ON auth_sessions (expires_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_auth_sessions_expires_at;
      DROP INDEX IF EXISTS ix_products_rest_active_created;
      DROP INDEX IF EXISTS ix_delivery_drivers_company_active_id;
      DROP INDEX IF EXISTS ix_restaurant_public_active;
      DROP INDEX IF EXISTS ix_users_active_verified_restaurants;
      DROP INDEX IF EXISTS ix_users_created_desc;
      DROP INDEX IF EXISTS ix_users_role_active_created;
      DROP INDEX IF EXISTS ix_cart_items_cart_id;
      DROP INDEX IF EXISTS ix_order_items_order_id;
      DROP INDEX IF EXISTS ix_orders_picked_up_updated;
      DROP INDEX IF EXISTS ix_orders_company_status_created_id;
      DROP INDEX IF EXISTS ix_orders_created_id;
      DROP INDEX IF EXISTS ix_orders_status_created_id;
    `);
  }
}
