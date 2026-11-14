import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Check,
} from 'typeorm';
@Entity('delivery_company_profiles')
@ForeignKey('users', ['user_id', 'profile_role'], ['user_id', 'role'], {
  name: 'fk_delivery_company_profiles_user_role',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_delivery_company_profiles_role', "profile_role = 'Delivery_Company'")
export class DeliveryCompanyProfile {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) company_id!: string;
  @Column({ type: 'bigint', unique: true }) user_id!: string;
  @Column({ type: 'varchar', length: 30, default: 'Delivery_Company' })
  profile_role!: 'Delivery_Company';
  @Column({ type: 'varchar', length: 150 }) company_name!: string;
  @Column({ type: 'varchar', length: 25 }) company_phone!: string;
  @Column({ type: 'varchar', length: 254, nullable: true }) company_email!:
    string | null;
  @Column({ type: 'text' }) company_address!: string;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
