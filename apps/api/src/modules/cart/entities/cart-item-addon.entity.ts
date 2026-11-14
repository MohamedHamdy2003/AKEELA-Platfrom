import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Index,
  Check,
} from 'typeorm';
@Entity('cart_item_addons')
@Index('uq_cart_item_addons_item_addon', ['cart_item_id', 'addon_id'], {
  unique: true,
})
@Index('ix_cart_item_addons_item', ['rest_id', 'cart_item_id', 'prod_id'])
@Index('ix_cart_item_addons_link', ['rest_id', 'prod_id', 'addon_id'])
@ForeignKey(
  'cart_items',
  ['rest_id', 'cart_item_id', 'prod_id'],
  ['rest_id', 'cart_item_id', 'prod_id'],
  {
    name: 'fk_cart_item_addons_item',
    onDelete: 'CASCADE',
    onUpdate: 'RESTRICT',
  },
)
@ForeignKey(
  'product_addons',
  ['rest_id', 'prod_id', 'addon_id'],
  ['rest_id', 'prod_id', 'addon_id'],
  {
    name: 'fk_cart_item_addons_link',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  },
)
@Check('ck_cart_item_addons_quantity', 'quantity > 0')
export class CartItemAddon {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  cart_item_addon_id!: string;
  @Column({ type: 'bigint' }) cart_item_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @Column({ type: 'bigint' }) prod_id!: string;
  @Column({ type: 'bigint' }) addon_id!: string;
  @Column({ type: 'integer' }) quantity!: number;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
