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

@Entity('customer_addresses')
@Index('ix_customer_addresses_user_id', ['user_id'])
@Index('ix_customer_addresses_default', ['user_id'], {
  unique: true,
  where: 'is_default = true',
})
@ForeignKey('customer_profiles', ['user_id'], ['user_id'], {
  name: 'fk_customer_addresses_customer',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_customer_addresses_longitude', 'longitude BETWEEN -180 AND 180')
@Check('ck_customer_addresses_latitude', 'latitude BETWEEN -90 AND 90')
export class CustomerAddress {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  address_id!: string;

  @Column({ type: 'bigint' })
  user_id!: string;

  @Column({ type: 'varchar', length: 100 })
  address_title!: string;

  @Column({ type: 'text' })
  address_line!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude!: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude!: string;

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
