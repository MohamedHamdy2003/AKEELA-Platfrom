import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ForeignKey,
  Index,
  Check,
} from 'typeorm';
@Entity('order_items')
@Index(
  'uq_order_items_rest_item_product',
  ['rest_id', 'order_item_id', 'prod_id'],
  { unique: true },
)
@Index('ix_order_items_order', ['rest_id', 'order_id'])
@ForeignKey('orders', ['rest_id', 'order_id'], ['rest_id', 'order_id'], {
  name: 'fk_order_items_order',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey('products', ['rest_id', 'prod_id'], ['rest_id', 'prod_id'], {
  name: 'fk_order_items_product',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey('offers', ['rest_id', 'offer_id'], ['rest_id', 'offer_id'], {
  name: 'fk_order_items_offer',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check(
  'ck_order_items_choice',
  '(prod_id IS NOT NULL AND offer_id IS NULL) OR (prod_id IS NULL AND offer_id IS NOT NULL)',
)
@Check('ck_order_items_values', 'quantity > 0 AND unit_price >= 0')
export class OrderItem {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  order_item_id!: string;
  @Column({ type: 'bigint' }) order_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @Column({ type: 'bigint', nullable: true }) prod_id!: string | null;
  @Column({ type: 'bigint', nullable: true }) offer_id!: string | null;
  @Column({ type: 'varchar', length: 150 }) item_name!: string;
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
