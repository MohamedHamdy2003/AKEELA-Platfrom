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
export const ORDER_STATUSES = [
  'Pending',
  'Accepted',
  'Picked_Up',
  'Delivered',
  'Rejected',
  'Cancelled',
  'Failed',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
@Entity('orders')
@Index('uq_orders_rest_order', ['rest_id', 'order_id'], { unique: true })
@Index('ix_orders_customer_created', ['customer_id', 'created_at', 'order_id'])
@Index('ix_orders_rest_status', ['rest_id', 'status', 'created_at'])
@Index('ix_orders_rest_created_id', ['rest_id', 'created_at', 'order_id'])
@Index('ix_orders_company_driver', ['company_id', 'driver_id'])
@Index('ix_orders_status_created_id', ['status', 'created_at', 'order_id'])
@Index('ix_orders_created_id', ['created_at', 'order_id'])
@Index(
  'ix_orders_company_status_created_id',
  ['company_id', 'status', 'created_at', 'order_id'],
  { where: 'company_id IS NOT NULL' },
)
@Index(
  'ix_orders_company_created_id',
  ['company_id', 'created_at', 'order_id'],
  {
    where: 'company_id IS NOT NULL',
  },
)
@Index('ix_orders_picked_up_updated', ['updated_at'], {
  where: "status = 'Picked_Up'",
})
@ForeignKey('customer_profiles', ['customer_id'], ['user_id'], {
  name: 'fk_orders_customer',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey('restaurant_profiles', ['rest_id'], ['rest_id'], {
  name: 'fk_orders_restaurant',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey('delivery_company_profiles', ['company_id'], ['company_id'], {
  name: 'fk_orders_company',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@ForeignKey(
  'delivery_drivers',
  ['company_id', 'driver_id'],
  ['company_id', 'driver_id'],
  { name: 'fk_orders_driver', onDelete: 'RESTRICT', onUpdate: 'RESTRICT' },
)
@Check(
  'ck_orders_status',
  "status IN ('Pending','Accepted','Picked_Up','Delivered','Rejected','Cancelled','Failed')",
)
@Check('ck_orders_driver', 'driver_id IS NULL OR company_id IS NOT NULL')
@Check('ck_orders_total', 'delivery_fee >= 0 AND total_price >= delivery_fee')
@Check('ck_orders_longitude', 'delivery_longitude BETWEEN -180 AND 180')
@Check('ck_orders_latitude', 'delivery_latitude BETWEEN -90 AND 90')
export class Order {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) order_id!: string;
  @Column({ type: 'bigint' }) customer_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @Column({ type: 'bigint', nullable: true }) company_id!: string | null;
  @Column({ type: 'bigint', nullable: true }) driver_id!: string | null;
  @Column({ type: 'varchar', length: 30, default: 'Pending' })
  status!: OrderStatus;
  @Column({ type: 'text' }) customer_address!: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  delivery_longitude!: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 })
  delivery_latitude!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) delivery_fee!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) total_price!: string;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
