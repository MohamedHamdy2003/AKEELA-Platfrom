import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Index,
} from 'typeorm';
@Entity('delivery_drivers')
@Index('uq_delivery_drivers_company_driver', ['company_id', 'driver_id'], {
  unique: true,
})
@ForeignKey('delivery_company_profiles', ['company_id'], ['company_id'], {
  name: 'fk_delivery_drivers_company',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
export class DeliveryDriver {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) driver_id!: string;
  @Column({ type: 'bigint' }) company_id!: string;
  @Column({ type: 'varchar', length: 150 }) driver_name!: string;
  @Column({ type: 'varchar', length: 25 }) driver_phone!: string;
  @Column({ type: 'varchar', length: 254, nullable: true }) driver_email!:
    string | null;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
