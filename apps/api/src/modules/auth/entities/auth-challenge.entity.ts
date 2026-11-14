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
export type ChallengePurpose = 'Email_Verification' | 'Password_Reset';
@Entity('auth_challenges')
@ForeignKey('users', ['user_id'], ['user_id'], {
  name: 'fk_auth_challenges_user',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check(
  'ck_challenge_purpose',
  "purpose IN ('Email_Verification','Password_Reset')",
)
@Check('ck_challenge_attempts', 'attempt_count >= 0')
@Check('ck_challenge_expiry', 'expires_at > created_at')
@Index('ix_challenge_expiry', ['expires_at'])
export class AuthChallenge {
  @PrimaryColumn({ type: 'bigint' }) user_id!: string;
  @PrimaryColumn({ type: 'varchar', length: 30 }) purpose!: ChallengePurpose;
  @Column({ type: 'varchar', length: 255, select: false }) otp_hash!: string;
  @Column({ type: 'integer', default: 0 }) attempt_count!: number;
  @Column({ type: 'timestamptz' }) expires_at!: Date;
  @Column({ type: 'timestamptz', nullable: true }) consumed_at!: Date | null;
  @Column({ type: 'timestamptz' }) next_send_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
