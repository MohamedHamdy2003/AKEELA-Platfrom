import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGlobalSearchIndexes1795000000000 implements MigrationInterface {
  name = 'AddGlobalSearchIndexes1795000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;

      CREATE OR REPLACE FUNCTION normalize_search_text(input TEXT)
      RETURNS TEXT
      LANGUAGE SQL
      IMMUTABLE
      PARALLEL SAFE
      RETURNS NULL ON NULL INPUT
      AS $$
        SELECT trim(
          regexp_replace(
            translate(
              regexp_replace(
                lower(input),
                U&'[\\064B-\\065F\\0670\\0640]+',
                '',
                'g'
              ),
              'أإآٱةىؤئ',
              'ااااهيوي'
            ),
            '\\s+',
            ' ',
            'g'
          )
        );
      $$;

      CREATE INDEX IF NOT EXISTS ix_search_restaurants_title_trgm
        ON restaurant_profiles
        USING GIN (normalize_search_text(rest_title) gin_trgm_ops)
        WHERE activation_status = 'Active' AND is_active = true;

      CREATE INDEX IF NOT EXISTS ix_search_restaurants_desc_trgm
        ON restaurant_profiles
        USING GIN (normalize_search_text(COALESCE(rest_description, '')) gin_trgm_ops)
        WHERE activation_status = 'Active' AND is_active = true;

      CREATE INDEX IF NOT EXISTS ix_search_categories_title_trgm
        ON categories
        USING GIN (normalize_search_text(cat_title) gin_trgm_ops)
        WHERE is_active = true;

      CREATE INDEX IF NOT EXISTS ix_search_products_name_trgm
        ON products
        USING GIN (normalize_search_text(prod_name) gin_trgm_ops)
        WHERE is_active = true AND cat_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS ix_search_products_desc_trgm
        ON products
        USING GIN (normalize_search_text(COALESCE(prod_description, '')) gin_trgm_ops)
        WHERE is_active = true AND cat_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS ix_search_offers_title_trgm
        ON offers
        USING GIN (normalize_search_text(offer_title) gin_trgm_ops)
        WHERE is_active = true;

      CREATE INDEX IF NOT EXISTS ix_search_offers_desc_trgm
        ON offers
        USING GIN (normalize_search_text(COALESCE(offer_description, '')) gin_trgm_ops)
        WHERE is_active = true;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_search_offers_desc_trgm;
      DROP INDEX IF EXISTS ix_search_offers_title_trgm;
      DROP INDEX IF EXISTS ix_search_products_desc_trgm;
      DROP INDEX IF EXISTS ix_search_products_name_trgm;
      DROP INDEX IF EXISTS ix_search_categories_title_trgm;
      DROP INDEX IF EXISTS ix_search_restaurants_desc_trgm;
      DROP INDEX IF EXISTS ix_search_restaurants_title_trgm;
      DROP FUNCTION IF EXISTS normalize_search_text(TEXT);
    `);
  }
}
