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
@Entity('cart_items')
@Index(
  'uq_cart_items_rest_item_product',
  ['rest_id', 'cart_item_id', 'prod_id'],
  { unique: true },
)
@Index('ix_cart_items_cart', ['rest_id', 'cart_id'])
@Index('ix_cart_items_product', ['rest_id', 'prod_id'])
@Index('ix_cart_items_offer', ['rest_id', 'offer_id'])
@Index('ix_cart_items_cart_id', ['cart_id', 'cart_item_id'])
@ForeignKey('carts', ['rest_id', 'cart_id'], ['rest_id', 'cart_id'], {
  name: 'fk_cart_items_cart',
  onDelete: 'CASCADE',
  onUpdate: 'RESTRICT',
})
@ForeignKey('products', ['rest_id', 'prod_id'], ['rest_id', 'prod_id'], {
  name: 'fk_cart_items_product',
  onDelete: 'CASCADE',
  onUpdate: 'RESTRICT',
})
@ForeignKey('offers', ['rest_id', 'offer_id'], ['rest_id', 'offer_id'], {
  name: 'fk_cart_items_offer',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check(
  'ck_cart_items_choice',
  '(prod_id IS NOT NULL AND offer_id IS NULL) OR (prod_id IS NULL AND offer_id IS NOT NULL)',
)
@Check('ck_cart_items_quantity', 'quantity > 0')
export class CartItem {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) cart_item_id!: string;
  @Column({ type: 'bigint' }) cart_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @Column({ type: 'bigint', nullable: true }) prod_id!: string | null;
  @Column({ type: 'bigint', nullable: true }) offer_id!: string | null;
  @Column({ type: 'integer' }) quantity!: number;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
