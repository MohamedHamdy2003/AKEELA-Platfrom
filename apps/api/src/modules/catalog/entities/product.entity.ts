import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Check,
  Index,
} from 'typeorm';

@Entity('products')
@Index('ix_products_rest_id', ['rest_id'])
@Index('ix_products_rest_cat', ['rest_id', 'cat_id'])
@Index('uq_products_rest_prod', ['rest_id', 'prod_id'], { unique: true })
@Index('ix_products_rest_active_created', [
  'rest_id',
  'is_active',
  'created_at',
  'prod_id',
])
@ForeignKey('categories', ['rest_id', 'cat_id'], ['rest_id', 'cat_id'], {
  name: 'fk_products_category',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_products_price', 'price >= 0')
@Check(
  'ck_products_unlinked_inactive',
  'cat_id IS NOT NULL OR is_active = false',
)
export class Product {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  prod_id!: string;

  @Column({ type: 'bigint' })
  rest_id!: string;

  @Column({ type: 'bigint', nullable: true })
  cat_id!: string | null;

  @Column({ type: 'varchar', length: 150 })
  prod_name!: string;

  @Column({ type: 'text', nullable: true })
  prod_description!: string | null;

  @Column({ type: 'text', nullable: true })
  prod_image_url!: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
