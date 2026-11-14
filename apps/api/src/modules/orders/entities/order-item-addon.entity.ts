import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ForeignKey,
  Index,
  Check,
} from 'typeorm';
@Entity('order_item_addons')
@Index('uq_order_item_addons_item_addon', ['order_item_id', 'addon_id'], {
  unique: true,
})
@Index('ix_order_item_addons_item', ['rest_id', 'order_item_id', 'prod_id'])
@Index('ix_order_item_addons_link', ['rest_id', 'prod_id', 'addon_id'])
@ForeignKey(
  'order_items',
  ['rest_id', 'order_item_id', 'prod_id'],
  ['rest_id', 'order_item_id', 'prod_id'],
  {
    name: 'fk_order_item_addons_item',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  },
)
@ForeignKey(
  'product_addons',
  ['rest_id', 'prod_id', 'addon_id'],
  ['rest_id', 'prod_id', 'addon_id'],
  {
    name: 'fk_order_item_addons_link',
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
  },
)
@Check('ck_order_item_addons_values', 'quantity > 0 AND unit_price >= 0')
export class OrderItemAddon {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  order_item_addon_id!: string;
  @Column({ type: 'bigint' }) order_item_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @Column({ type: 'bigint' }) prod_id!: string;
  @Column({ type: 'bigint' }) addon_id!: string;
  @Column({ type: 'varchar', length: 150 }) addon_name!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) unit_price!: string;
  @Column({ type: 'integer' }) quantity!: number;
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    asExpression: 'unit_price * quantity',
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  subtotal!: string;
}
