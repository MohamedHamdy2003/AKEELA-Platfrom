import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ForeignKey,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export const DEVICE_PLATFORMS = ['android', 'ios', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

@Entity('device_tokens')
@Unique('uq_device_tokens_fcm_token', ['fcm_token'])
@Index('ix_device_tokens_user_id', ['user_id'])
@Index('ix_device_tokens_session_id', ['session_id'], {
  where: 'session_id IS NOT NULL',
})
@ForeignKey('users', ['user_id'], ['user_id'], {
  name: 'fk_device_tokens_user',
  onDelete: 'CASCADE',
  onUpdate: 'RESTRICT',
})
@ForeignKey('auth_sessions', ['session_id'], ['session_id'], {
  name: 'fk_device_tokens_session',
  onDelete: 'CASCADE',
  onUpdate: 'RESTRICT',
})
@Check('ck_device_tokens_platform', "platform IN ('android', 'ios', 'web')")
export class DeviceToken {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  token_id!: string;

  @Column({ type: 'bigint' })
  user_id!: string;

  @Column({ type: 'uuid', nullable: true })
  session_id!: string | null;

  @Column({ type: 'varchar', length: 512 })
  fcm_token!: string;

  @Column({ type: 'varchar', length: 16 })
  platform!: DevicePlatform;

  @Column({ type: 'varchar', length: 100, nullable: true })
  device_label!: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  last_seen_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
