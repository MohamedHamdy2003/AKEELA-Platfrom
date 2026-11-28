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

@Entity('addons')
@Index('uq_addons_rest_addon', ['rest_id', 'addon_id'], { unique: true })
@ForeignKey('restaurant_profiles', ['rest_id'], ['rest_id'], {
  name: 'fk_addons_restaurant',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_addons_price', 'addon_price >= 0')
export class Addon {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  addon_id!: string;

  @Column({ type: 'bigint' })
  rest_id!: string;

  @Column({ type: 'varchar', length: 150 })
  addon_name!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  addon_price!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
