import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Check,
} from 'typeorm';
@Entity('admin_profiles')
@ForeignKey('users', ['user_id', 'profile_role'], ['user_id', 'role'], {
  name: 'fk_admin_profiles_user_role',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_admin_profiles_role', "profile_role = 'Admin'")
export class AdminProfile {
  @PrimaryColumn({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'varchar', length: 30, default: 'Admin' })
  profile_role!: 'Admin';

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
