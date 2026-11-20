import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Check,
  Index,
} from 'typeorm';
@Entity('auth_sessions')
@ForeignKey('users', ['user_id'], ['user_id'], {
  name: 'fk_auth_sessions_user',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_session_expiry', 'expires_at > created_at')
@Index('ix_session_user_revoked', ['user_id', 'revoked_at'])
@Index('ix_auth_sessions_expires_at', ['expires_at'])
export class AuthSession {
  @PrimaryColumn({ type: 'uuid' }) session_id!: string;
  @Column({ type: 'bigint' }) user_id!: string;
  @Column({ type: 'varchar', length: 255, unique: true, select: false })
  refresh_token_hash!: string;
  @Column({ type: 'timestamptz' }) expires_at!: Date;
  @Column({ type: 'timestamptz', nullable: true }) revoked_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
