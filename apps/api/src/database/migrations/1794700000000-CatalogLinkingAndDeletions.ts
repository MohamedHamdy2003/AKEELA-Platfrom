import { MigrationInterface, QueryRunner } from 'typeorm';

export class CatalogLinkingAndDeletions1794700000000 implements MigrationInterface {
  name = 'CatalogLinkingAndDeletions1794700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
-- 1. Normalize existing category display_order per restaurant to contiguous 1..N and enforce deferrable uniqueness.
WITH ranked AS (
  SELECT
    cat_id,
    ROW_NUMBER() OVER (PARTITION BY rest_id ORDER BY display_order ASC, cat_id ASC) AS rn
  FROM categories
)
UPDATE categories c
SET display_order = ranked.rn
FROM ranked
WHERE c.cat_id = ranked.cat_id;

ALTER TABLE categories
  ADD CONSTRAINT uq_categories_rest_display_order UNIQUE (rest_id, display_order) DEFERRABLE INITIALLY DEFERRED;

-- 2. Allow uncategorized (unlinked) products, strictly enforcing that unlinked products remain inactive.
ALTER TABLE products ALTER COLUMN cat_id DROP NOT NULL;
ALTER TABLE products
  ADD CONSTRAINT ck_products_unlinked_inactive CHECK (cat_id IS NOT NULL OR is_active = false);

-- 3. Deactivate any existing addons that have no active product links.
UPDATE addons a
SET is_active = false
WHERE a.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM product_addons pa
    WHERE pa.rest_id = a.rest_id
      AND pa.addon_id = a.addon_id
      AND pa.is_active = true
  );

-- 4. Cascade product/addon hard deletes cleanly through product_addons and open customer carts.
ALTER TABLE product_addons DROP CONSTRAINT fk_product_addons_product;
ALTER TABLE product_addons
  ADD CONSTRAINT fk_product_addons_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE product_addons DROP CONSTRAINT fk_product_addons_addon;
ALTER TABLE product_addons
  ADD CONSTRAINT fk_product_addons_addon
  FOREIGN KEY (rest_id, addon_id) REFERENCES addons(rest_id, addon_id)
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE cart_items DROP CONSTRAINT fk_cart_items_product;
ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_items_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE CASCADE ON UPDATE RESTRICT;

ALTER TABLE cart_item_addons DROP CONSTRAINT fk_cart_item_addons_link;
ALTER TABLE cart_item_addons
  ADD CONSTRAINT fk_cart_item_addons_link
  FOREIGN KEY (rest_id, prod_id, addon_id) REFERENCES product_addons(rest_id, prod_id, addon_id)
  ON DELETE CASCADE ON UPDATE RESTRICT;

-- 5. Preserve historical order snapshots when an unlinked product or addon is permanently deleted (PostgreSQL 15+ column-level ON DELETE SET NULL).
CREATE UNIQUE INDEX uq_order_items_rest_item ON order_items(rest_id, order_item_id);

ALTER TABLE order_item_addons DROP CONSTRAINT fk_order_item_addons_item;
ALTER TABLE order_item_addons DROP CONSTRAINT fk_order_item_addons_link;
ALTER TABLE order_item_addons ALTER COLUMN prod_id DROP NOT NULL;
ALTER TABLE order_item_addons ALTER COLUMN addon_id DROP NOT NULL;

ALTER TABLE order_item_addons
  ADD CONSTRAINT fk_order_item_addons_item
  FOREIGN KEY (rest_id, order_item_id) REFERENCES order_items(rest_id, order_item_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE order_item_addons
  ADD CONSTRAINT fk_order_item_addons_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE SET NULL (prod_id) ON UPDATE RESTRICT;

ALTER TABLE order_item_addons
  ADD CONSTRAINT fk_order_item_addons_addon
  FOREIGN KEY (rest_id, addon_id) REFERENCES addons(rest_id, addon_id)
  ON DELETE SET NULL (addon_id) ON UPDATE RESTRICT;

ALTER TABLE order_items DROP CONSTRAINT fk_order_items_product;
ALTER TABLE order_items DROP CONSTRAINT ck_order_items_choice;

ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE SET NULL (prod_id) ON UPDATE RESTRICT;

ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_choice
  CHECK (NOT (prod_id IS NOT NULL AND offer_id IS NOT NULL));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
ALTER TABLE order_items DROP CONSTRAINT ck_order_items_choice;
ALTER TABLE order_items DROP CONSTRAINT fk_order_items_product;
ALTER TABLE order_items
  ADD CONSTRAINT fk_order_items_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE order_items
  ADD CONSTRAINT ck_order_items_choice
  CHECK ((prod_id IS NOT NULL AND offer_id IS NULL) OR (prod_id IS NULL AND offer_id IS NOT NULL));

ALTER TABLE order_item_addons DROP CONSTRAINT fk_order_item_addons_addon;
ALTER TABLE order_item_addons DROP CONSTRAINT fk_order_item_addons_product;
ALTER TABLE order_item_addons DROP CONSTRAINT fk_order_item_addons_item;
ALTER TABLE order_item_addons ALTER COLUMN addon_id SET NOT NULL;
ALTER TABLE order_item_addons ALTER COLUMN prod_id SET NOT NULL;
ALTER TABLE order_item_addons
  ADD CONSTRAINT fk_order_item_addons_item
  FOREIGN KEY (rest_id, order_item_id, prod_id) REFERENCES order_items(rest_id, order_item_id, prod_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE order_item_addons
  ADD CONSTRAINT fk_order_item_addons_link
  FOREIGN KEY (rest_id, prod_id, addon_id) REFERENCES product_addons(rest_id, prod_id, addon_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP INDEX uq_order_items_rest_item;

ALTER TABLE cart_item_addons DROP CONSTRAINT fk_cart_item_addons_link;
ALTER TABLE cart_item_addons
  ADD CONSTRAINT fk_cart_item_addons_link
  FOREIGN KEY (rest_id, prod_id, addon_id) REFERENCES product_addons(rest_id, prod_id, addon_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE cart_items DROP CONSTRAINT fk_cart_items_product;
ALTER TABLE cart_items
  ADD CONSTRAINT fk_cart_items_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE product_addons DROP CONSTRAINT fk_product_addons_addon;
ALTER TABLE product_addons
  ADD CONSTRAINT fk_product_addons_addon
  FOREIGN KEY (rest_id, addon_id) REFERENCES addons(rest_id, addon_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE product_addons DROP CONSTRAINT fk_product_addons_product;
ALTER TABLE product_addons
  ADD CONSTRAINT fk_product_addons_product
  FOREIGN KEY (rest_id, prod_id) REFERENCES products(rest_id, prod_id)
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE products DROP CONSTRAINT ck_products_unlinked_inactive;
ALTER TABLE products ALTER COLUMN cat_id SET NOT NULL;

ALTER TABLE categories DROP CONSTRAINT uq_categories_rest_display_order;
    `);
  }
}
