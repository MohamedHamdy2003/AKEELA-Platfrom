import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';
import { Addon } from './entities/addon.entity';
import { ProductAddon } from './entities/product-addon.entity';
import { Offer } from './entities/offer.entity';
import { PaginationQuery } from '../users/admin.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateCategoryDto {
  @ApiProperty({
    type: 'string',
    description: 'cat title.',
    minLength: 1,
    maxLength: 150,
    example: 'Sandwiches',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the category title as text.' })
  @Length(1, 150, {
    message: 'Category title must be between 1 and 150 characters.',
  })
  cat_title!: string;

  @ApiProperty({
    type: 'integer',
    description:
      'Optional legacy field ignored on create; display_order is automatically assigned the next sequential position (1..N).',
    nullable: true,
    minimum: 0,
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'display_order must be an integer.' })
  @Min(0, { message: 'display_order must be 0 or greater.' })
  display_order?: number;

  @ApiProperty({
    type: 'boolean',
    description: 'is active.',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class UpdateCategoryDto {
  @ApiProperty({
    type: 'string',
    description: 'cat title.',
    minLength: 1,
    maxLength: 150,
    example: 'Sandwiches',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the category title as text.' })
  @Length(1, 150, {
    message: 'Category title must be between 1 and 150 characters.',
  })
  cat_title?: string;

  @ApiProperty({
    type: 'integer',
    description:
      'Target 1-based display_order of an existing owned category to swap positions with.',
    minimum: 1,
    example: 1,
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsInt({ message: 'display_order must be an integer.' })
  @Min(1, { message: 'display_order must be 1 or greater.' })
  display_order?: number;

  @ApiProperty({ type: 'boolean', description: 'is active.', required: false })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class ListCategoriesQuery extends PaginationQuery {}

export interface CategoryResponse {
  cat_id: string;
  rest_id: string;
  cat_title: string;
  display_order: number;
  is_active: boolean;
  product_count: number;
  created_at: string;
  updated_at: string;
}

export function serializeCategory(
  c: Category,
  productCount = 0,
): CategoryResponse {
  return {
    cat_id: c.cat_id.toString(),
    rest_id: c.rest_id.toString(),
    cat_title: c.cat_title,
    display_order: Number(c.display_order),
    is_active: Boolean(c.is_active),
    product_count: productCount,
    created_at:
      c.created_at instanceof Date
        ? c.created_at.toISOString()
        : new Date(c.created_at).toISOString(),
    updated_at:
      c.updated_at instanceof Date
        ? c.updated_at.toISOString()
        : new Date(c.updated_at).toISOString(),
  };
}

export class CreateProductDto {
  @ApiProperty({
    type: 'string',
    description:
      'Optional owning category ID (positive PostgreSQL BIGINT as a decimal string). Omit or pass null to create an unlinked inactive product.',
    nullable: true,
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: false,
  })
  @IsOptional()
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString({ message: 'Enter the category ID as text.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'Category ID must be a positive integer.',
  })
  cat_id?: string | null;

  @ApiProperty({
    type: 'string',
    description: 'prod name.',
    minLength: 1,
    maxLength: 150,
    example: 'Burger',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the product name as text.' })
  @Length(1, 150, {
    message: 'Product name must be between 1 and 150 characters.',
  })
  prod_name!: string;

  @ApiProperty({
    type: 'string',
    description: 'prod description.',
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Enter the product description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  prod_description?: string | null;

  @ApiProperty({
    type: 'string',
    description: 'prod image url.',
    nullable: true,
    format: 'uri',
    maxLength: 2048,
    required: false,
  })
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  prod_image_url?: string | null;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '100.00',
    required: true,
  })
  @IsString({ message: 'Enter price as text, for example "100.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  price!: string;

  @ApiProperty({
    type: 'boolean',
    description: 'is active.',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class UpdateProductDto {
  @ApiProperty({
    type: 'string',
    description:
      'Owning category ID (positive PostgreSQL BIGINT as a decimal string), or null to unlink and deactivate the product.',
    nullable: true,
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString({ message: 'Enter the category ID as text.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'Category ID must be a positive integer.',
  })
  cat_id?: string | null;

  @ApiProperty({
    type: 'string',
    description: 'prod name.',
    minLength: 1,
    maxLength: 150,
    example: 'Burger',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the product name as text.' })
  @Length(1, 150, {
    message: 'Product name must be between 1 and 150 characters.',
  })
  prod_name?: string;

  @ApiProperty({
    type: 'string',
    description: 'prod description.',
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsString({ message: 'Enter the product description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  prod_description?: string | null;

  @ApiProperty({
    type: 'string',
    description: 'prod image url.',
    nullable: true,
    format: 'uri',
    maxLength: 2048,
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  prod_image_url?: string | null;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '100.00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter price as text, for example "100.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  price?: string;

  @ApiProperty({ type: 'boolean', description: 'is active.', required: false })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class ListProductsQuery extends PaginationQuery {
  @ApiProperty({
    type: 'string',
    description:
      'Positive PostgreSQL BIGINT ID as a decimal string (maximum 9223372036854775807).',
    nullable: true,
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: false,
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'cat_id must be text.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'cat_id must be a positive integer.',
  })
  cat_id?: string;
}

export class ListRestaurantProductsQuery extends ListProductsQuery {
  @ApiProperty({
    type: 'string',
    enum: ['true', 'false'],
    nullable: true,
    required: false,
    description:
      'Filter by category link state: true returns unlinked inactive products only, false returns categorized products only.',
  })
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'unlinked must be either "true" or "false".',
  })
  unlinked?: 'true' | 'false';
}

export interface ProductResponse {
  prod_id: string;
  rest_id: string;
  cat_id: string | null;
  prod_name: string;
  prod_description: string | null;
  prod_image_url: string | null;
  price: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function serializeProduct(p: Product): ProductResponse {
  return {
    prod_id: p.prod_id.toString(),
    rest_id: p.rest_id.toString(),
    cat_id: p.cat_id ? p.cat_id.toString() : null,
    prod_name: p.prod_name,
    prod_description: p.prod_description ?? null,
    prod_image_url: p.prod_image_url ?? null,
    price: p.price,
    is_active: Boolean(p.is_active),
    created_at:
      p.created_at instanceof Date
        ? p.created_at.toISOString()
        : new Date(p.created_at).toISOString(),
    updated_at:
      p.updated_at instanceof Date
        ? p.updated_at.toISOString()
        : new Date(p.updated_at).toISOString(),
  };
}

export class CreateAddonDto {
  @ApiProperty({
    type: 'string',
    description: 'addon name.',
    minLength: 1,
    maxLength: 150,
    example: 'Cheese',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the addon name as text.' })
  @Length(1, 150, {
    message: 'Addon name must be between 1 and 150 characters.',
  })
  addon_name!: string;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '10.00',
    required: true,
  })
  @IsString({ message: 'Enter addon price as text, for example "10.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter addon price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  addon_price!: string;

  @ApiProperty({
    type: 'boolean',
    description: 'is active.',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class UpdateAddonDto {
  @ApiProperty({
    type: 'string',
    description: 'addon name.',
    minLength: 1,
    maxLength: 150,
    example: 'Cheese',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the addon name as text.' })
  @Length(1, 150, {
    message: 'Addon name must be between 1 and 150 characters.',
  })
  addon_name?: string;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '10.00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter addon price as text, for example "10.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter addon price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  addon_price?: string;

  @ApiProperty({ type: 'boolean', description: 'is active.', required: false })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class ListAddonsQuery extends PaginationQuery {
  @ApiProperty({
    type: 'string',
    enum: ['true', 'false'],
    nullable: true,
    required: false,
    description:
      'Filter by product link state: true returns unlinked inactive addons only, false returns addons linked to at least one product.',
  })
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'unlinked must be either "true" or "false".',
  })
  unlinked?: 'true' | 'false';
}

export class SetProductAddonDto {
  @ApiProperty({
    type: 'boolean',
    description: 'is active.',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export interface AddonResponse {
  addon_id: string;
  rest_id: string;
  addon_name: string;
  addon_price: string;
  is_active: boolean;
  linked_product_ids: string[];
  created_at: string;
  updated_at: string;
}

export function serializeAddon(
  a: Addon,
  linkedProductIds: string[] = [],
): AddonResponse {
  return {
    addon_id: a.addon_id.toString(),
    rest_id: a.rest_id.toString(),
    addon_name: a.addon_name,
    addon_price: a.addon_price,
    is_active: Boolean(a.is_active),
    linked_product_ids: linkedProductIds,
    created_at:
      a.created_at instanceof Date
        ? a.created_at.toISOString()
        : new Date(a.created_at).toISOString(),
    updated_at:
      a.updated_at instanceof Date
        ? a.updated_at.toISOString()
        : new Date(a.updated_at).toISOString(),
  };
}

export interface ProductAddonResponse {
  rest_id: string;
  prod_id: string;
  addon_id: string;
  is_active: boolean;
  addon: AddonResponse;
  created_at: string;
  updated_at: string;
}

export function serializeProductAddon(
  pa: ProductAddon,
  addon: Addon,
  linkedProductIds: string[] = [],
): ProductAddonResponse {
  return {
    rest_id: pa.rest_id.toString(),
    prod_id: pa.prod_id.toString(),
    addon_id: pa.addon_id.toString(),
    is_active: Boolean(pa.is_active),
    addon: serializeAddon(addon, linkedProductIds),
    created_at:
      pa.created_at instanceof Date
        ? pa.created_at.toISOString()
        : new Date(pa.created_at).toISOString(),
    updated_at:
      pa.updated_at instanceof Date
        ? pa.updated_at.toISOString()
        : new Date(pa.updated_at).toISOString(),
  };
}

// --- Feature 08: Offers ---

export class CreateOfferDto {
  @ApiProperty({
    type: 'string',
    description: 'offer title.',
    minLength: 1,
    maxLength: 150,
    example: 'Lunch offer',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the offer title as text.' })
  @Length(1, 150, {
    message: 'Offer title must be between 1 and 150 characters.',
  })
  offer_title!: string;

  @ApiProperty({
    type: 'string',
    description: 'offer description.',
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Enter the offer description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  offer_description?: string | null;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '150.00',
    required: true,
  })
  @IsString({ message: 'Enter initial price as text, for example "150.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter initial price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  initial_price!: string;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '130.00',
    required: true,
  })
  @IsString({ message: 'Enter real price as text, for example "130.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter real price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  real_price!: string;

  @ApiProperty({
    type: 'string',
    description: 'offer image url.',
    nullable: true,
    format: 'uri',
    maxLength: 2048,
    required: false,
  })
  @IsOptional()
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  offer_image_url?: string | null;

  @ApiProperty({
    type: 'boolean',
    description: 'is active.',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;

  @ApiProperty({
    type: 'string',
    description:
      'ISO 8601 timestamp with explicit Z or UTC offset. Must be before expires_at.',
    format: 'date-time',
    example: '2026-12-01T10:00:00+02:00',
    required: true,
  })
  @IsDateString(
    { strict: true },
    { message: 'Enter starts_at as a UTC ISO 8601 timestamp.' },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Include Z or an explicit timezone offset in the start time.',
  })
  starts_at!: string;

  @ApiProperty({
    type: 'string',
    description:
      'ISO 8601 timestamp with explicit Z or UTC offset. Must be after starts_at.',
    format: 'date-time',
    example: '2026-12-31T22:00:00+02:00',
    required: true,
  })
  @IsDateString(
    { strict: true },
    { message: 'Enter expires_at as a UTC ISO 8601 timestamp.' },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Include Z or an explicit timezone offset in the end time.',
  })
  expires_at!: string;
}

export class UpdateOfferDto {
  @ApiProperty({
    type: 'string',
    description: 'offer title.',
    minLength: 1,
    maxLength: 150,
    example: 'Lunch offer',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the offer title as text.' })
  @Length(1, 150, {
    message: 'Offer title must be between 1 and 150 characters.',
  })
  offer_title?: string;

  @ApiProperty({
    type: 'string',
    description: 'offer description.',
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsString({ message: 'Enter the offer description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  offer_description?: string | null;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '150.00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter initial price as text, for example "150.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter initial price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  initial_price?: string;

  @ApiProperty({
    type: 'string',
    description:
      'EGP amount as a decimal string, up to 10 whole digits and 2 decimal places. Never use floating-point arithmetic for money.',
    pattern: '^\\d{1,10}(\\.\\d{1,2})?$',
    example: '130.00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter real price as text, for example "130.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter real price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  real_price?: string;

  @ApiProperty({
    type: 'string',
    description: 'offer image url.',
    nullable: true,
    format: 'uri',
    maxLength: 2048,
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  offer_image_url?: string | null;

  @ApiProperty({ type: 'boolean', description: 'is active.', required: false })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;

  @ApiProperty({
    type: 'string',
    description:
      'ISO 8601 timestamp with explicit Z or UTC offset. Must be before expires_at.',
    format: 'date-time',
    example: '2026-12-01T10:00:00+02:00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsDateString(
    { strict: true },
    { message: 'Enter starts_at as a UTC ISO 8601 timestamp.' },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Include Z or an explicit timezone offset in the start time.',
  })
  starts_at?: string;

  @ApiProperty({
    type: 'string',
    description:
      'ISO 8601 timestamp with explicit Z or UTC offset. Must be after starts_at.',
    format: 'date-time',
    example: '2026-12-31T22:00:00+02:00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsDateString(
    { strict: true },
    { message: 'Enter expires_at as a UTC ISO 8601 timestamp.' },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Include Z or an explicit timezone offset in the end time.',
  })
  expires_at?: string;
}

export class ListOffersQuery extends PaginationQuery {}

export interface OfferResponse {
  offer_id: string;
  rest_id: string;
  offer_title: string;
  offer_description: string | null;
  initial_price: string;
  real_price: string;
  offer_image_url: string | null;
  is_active: boolean;
  starts_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export function serializeOffer(o: Offer): OfferResponse {
  return {
    offer_id: o.offer_id.toString(),
    rest_id: o.rest_id.toString(),
    offer_title: o.offer_title,
    offer_description: o.offer_description ?? null,
    initial_price: o.initial_price,
    real_price: o.real_price,
    offer_image_url: o.offer_image_url ?? null,
    is_active: Boolean(o.is_active),
    starts_at:
      o.starts_at instanceof Date
        ? o.starts_at.toISOString()
        : new Date(o.starts_at).toISOString(),
    expires_at:
      o.expires_at instanceof Date
        ? o.expires_at.toISOString()
        : new Date(o.expires_at).toISOString(),
    created_at:
      o.created_at instanceof Date
        ? o.created_at.toISOString()
        : new Date(o.created_at).toISOString(),
    updated_at:
      o.updated_at instanceof Date
        ? o.updated_at.toISOString()
        : new Date(o.updated_at).toISOString(),
  };
}

// --- Feature 09: Public Menu types ---

export interface PublicRestaurantResponse {
  rest_id: string;
  rest_title: string;
  rest_description: string | null;
  rest_image_url_mobile: string | null;
  rest_address: string;
  longitude: string;
  latitude: string;
  opens_at: string;
  closes_at: string;
  is_open: boolean;
}

export interface PublicCategoryResponse {
  cat_id: string;
  cat_title: string;
  display_order: number;
}

export interface PublicProductResponse {
  prod_id: string;
  cat_id: string;
  prod_name: string;
  prod_description: string | null;
  prod_image_url: string | null;
  price: string;
}

export interface PublicAddonResponse {
  addon_id: string;
  addon_name: string;
  addon_price: string;
}

export interface PublicProductDetailsResponse extends PublicProductResponse {
  addons: PublicAddonResponse[];
}

export interface PublicOfferResponse {
  offer_id: string;
  rest_id: string;
  offer_title: string;
  offer_description: string | null;
  initial_price: string;
  real_price: string;
  offer_image_url: string | null;
  starts_at: string;
  expires_at: string;
}
