import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ForeignKey,
  Check,
  Index,
  Unique,
} from 'typeorm';

@Entity('categories')
@Index('uq_categories_rest_title', ['rest_id', 'cat_title'], { unique: true })
@Index('uq_categories_rest_cat', ['rest_id', 'cat_id'], { unique: true })
@Unique('uq_categories_rest_display_order', ['rest_id', 'display_order'], {
  deferrable: 'INITIALLY DEFERRED',
})
@ForeignKey('restaurant_profiles', ['rest_id'], ['rest_id'], {
  name: 'fk_categories_restaurant',
  onDelete: 'RESTRICT',
  onUpdate: 'RESTRICT',
})
@Check('ck_categories_display_order', 'display_order >= 0')
export class Category {
  @PrimaryGeneratedColumn('identity', { type: 'bigint' })
  cat_id!: string;

  @Column({ type: 'bigint' })
  rest_id!: string;

  @Column({ type: 'varchar', length: 150 })
  cat_title!: string;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'integer', default: 0 })
  display_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
