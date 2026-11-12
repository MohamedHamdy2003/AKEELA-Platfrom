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
@Entity('restaurant_profiles')
@Index('ix_restaurant_activation_created', ['activation_status', 'created_at'])
@ForeignKey('users', ['user_id', 'profile_role'], ['user_id', 'role'], {
  name: 'fk_restaurant_profiles_user_role',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_restaurant_profiles_role', "profile_role = 'Restaurant'")
@Check(
  'ck_restaurant_activation',
  "activation_status IN ('Pending','Active','Suspended')",
)
@Check('ck_restaurant_longitude', 'longitude BETWEEN -180 AND 180')
@Check('ck_restaurant_latitude', 'latitude BETWEEN -90 AND 90')
@Check('ck_restaurant_hours', 'opens_at <> closes_at')
export class RestaurantProfile {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' }) rest_id!: string;
  @Column({ type: 'bigint', unique: true }) user_id!: string;
  @Column({ type: 'varchar', length: 30, default: 'Restaurant' })
  profile_role!: 'Restaurant';
  @Column({ type: 'varchar', length: 150 }) rest_title!: string;
  @Column({ type: 'text', nullable: true }) rest_description!: string | null;
  @Column({ type: 'text', nullable: true }) rest_image_url_mobile!:
    string | null;
  @Column({ type: 'text' }) rest_address!: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) longitude!: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) latitude!: string;
  @Column({ type: 'time' }) opens_at!: string;
  @Column({ type: 'time' }) closes_at!: string;
  @Column({ type: 'varchar', length: 20, default: 'Pending' })
  activation_status!: 'Pending' | 'Active' | 'Suspended';
  @Column({ type: 'boolean', default: true }) is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
