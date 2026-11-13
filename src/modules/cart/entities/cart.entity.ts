import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Index,
} from 'typeorm';
@Entity('carts')
@Index('uq_carts_customer', ['customer_id'], { unique: true })
@Index('uq_carts_rest_cart', ['rest_id', 'cart_id'], { unique: true })
@ForeignKey('customer_profiles', ['customer_id'], ['user_id'], {
  name: 'fk_carts_customer',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey('restaurant_profiles', ['rest_id'], ['rest_id'], {
  name: 'fk_carts_restaurant',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
export class Cart {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) cart_id!: string;
  @Column({ type: 'bigint' }) customer_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
