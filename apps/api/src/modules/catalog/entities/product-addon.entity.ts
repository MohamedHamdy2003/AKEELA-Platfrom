import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Index,
} from 'typeorm';

@Entity('product_addons')
@Index('ix_product_addons_rest_addon', ['rest_id', 'addon_id'])
@ForeignKey('products', ['rest_id', 'prod_id'], ['rest_id', 'prod_id'], {
  name: 'fk_product_addons_product',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey('addons', ['rest_id', 'addon_id'], ['rest_id', 'addon_id'], {
  name: 'fk_product_addons_addon',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
export class ProductAddon {
  @PrimaryColumn({ type: 'bigint' })
  rest_id!: string;

  @PrimaryColumn({ type: 'bigint' })
  prod_id!: string;

  @PrimaryColumn({ type: 'bigint' })
  addon_id!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
