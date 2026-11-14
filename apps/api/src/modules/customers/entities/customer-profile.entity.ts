import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Check,
} from 'typeorm';
@Entity('customer_profiles')
@ForeignKey('users', ['user_id', 'profile_role'], ['user_id', 'role'], {
  name: 'fk_customer_profiles_user_role',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_customer_profiles_role', "profile_role = 'Customer'")
export class CustomerProfile {
  @PrimaryColumn({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'varchar', length: 30, default: 'Customer' })
  profile_role!: 'Customer';
  @Column({ type: 'text', nullable: true }) cus_avatar_url!: string | null;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
