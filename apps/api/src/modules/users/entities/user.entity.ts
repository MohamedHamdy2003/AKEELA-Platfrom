import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Check,
  Index,
} from 'typeorm';
import { Account, Role } from '../account.types';
@Entity('users')
@Index('ix_users_role_active_created', ['role', 'is_active', 'created_at'])
@Index('ix_users_created_desc', ['created_at'])
@Index('ix_users_active_verified_restaurants', ['user_id'], {
  where:
    "role = 'Restaurant' AND is_active = true AND email_verified_at IS NOT NULL",
})
@Unique('uq_users_email', ['email'])
@Unique('uq_users_phone', ['phone_number'])
@Unique('uq_users_id_role', ['user_id', 'role'])
@Check(
  'ck_users_role',
  "role IN ('Customer','Restaurant','Delivery_Company','Admin')",
)
@Check('ck_users_email_normalized', 'email = lower(btrim(email))')
export class User implements Account {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) user_id!: string;
  @Column({ type: 'varchar', length: 150 }) full_name!: string;
  @Column({ type: 'varchar', length: 254 }) email!: string;
  @Column({ type: 'varchar', length: 25 }) phone_number!: string;
  @Column({ type: 'varchar', length: 255, select: false })
  password_hash!: string;
  @Column({ type: 'varchar', length: 30 }) role!: Role;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @Column({ type: 'timestamptz', nullable: true })
  email_verified_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
