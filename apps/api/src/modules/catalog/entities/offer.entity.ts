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

@Entity('offers')
@Index('ix_offers_rest_id', ['rest_id'])
@Index('ix_offers_rest_active_window', [
  'rest_id',
  'is_active',
  'starts_at',
  'expires_at',
])
@Index(
  'ix_offers_public_active_window',
  ['starts_at', 'expires_at', 'rest_id'],
  {
    where: 'is_active = true',
  },
)
@Index('uq_offers_rest_offer', ['rest_id', 'offer_id'], { unique: true })
@ForeignKey('restaurant_profiles', ['rest_id'], ['rest_id'], {
  name: 'fk_offers_restaurant',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check(
  'ck_offers_prices',
  'initial_price >= 0 AND real_price >= 0 AND real_price <= initial_price',
)
@Check('ck_offers_dates', 'expires_at > starts_at')
export class Offer {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) offer_id!: string;
  @Column({ type: 'bigint' }) rest_id!: string;
  @Column({ type: 'varchar', length: 150 }) offer_title!: string;
  @Column({ type: 'text', nullable: true }) offer_description!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) initial_price!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) real_price!: string;
  @Column({ type: 'text', nullable: true }) offer_image_url!: string | null;
  @Column({ type: 'boolean', default: true }) is_active!: boolean;
  @Column({ type: 'timestamptz' }) starts_at!: Date;
  @Column({ type: 'timestamptz' }) expires_at!: Date;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
