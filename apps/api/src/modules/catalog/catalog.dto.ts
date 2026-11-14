import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
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
  @Transform(trim)
  @IsString({ message: 'Enter the category title as text.' })
  @Length(1, 150, {
    message: 'Category title must be between 1 and 150 characters.',
  })
  cat_title!: string;

  @IsOptional()
  @IsInt({ message: 'display_order must be an integer.' })
  @Min(0, { message: 'display_order must be 0 or greater.' })
  display_order?: number;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class UpdateCategoryDto {
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the category title as text.' })
  @Length(1, 150, {
    message: 'Category title must be between 1 and 150 characters.',
  })
  cat_title?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsInt({ message: 'display_order must be an integer.' })
  @Min(0, { message: 'display_order must be 0 or greater.' })
  display_order?: number;

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
  created_at: string;
  updated_at: string;
}

export function serializeCategory(c: Category): CategoryResponse {
  return {
    cat_id: c.cat_id.toString(),
    rest_id: c.rest_id.toString(),
    cat_title: c.cat_title,
    display_order: Number(c.display_order),
    is_active: Boolean(c.is_active),
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
  @Transform(trim)
  @IsString({ message: 'Enter the category ID as text.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'Category ID must be a positive integer.',
  })
  cat_id!: string;

  @Transform(trim)
  @IsString({ message: 'Enter the product name as text.' })
  @Length(1, 150, {
    message: 'Product name must be between 1 and 150 characters.',
  })
  prod_name!: string;

  @IsOptional()
  @IsString({ message: 'Enter the product description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  prod_description?: string | null;

  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  prod_image_url?: string | null;

  @IsString({ message: 'Enter price as text, for example "100.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  price!: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class UpdateProductDto {
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the category ID as text.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'Category ID must be a positive integer.',
  })
  cat_id?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the product name as text.' })
  @Length(1, 150, {
    message: 'Product name must be between 1 and 150 characters.',
  })
  prod_name?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsString({ message: 'Enter the product description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  prod_description?: string | null;

  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  prod_image_url?: string | null;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter price as text, for example "100.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  price?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class ListProductsQuery extends PaginationQuery {
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'cat_id must be text.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'cat_id must be a positive integer.',
  })
  cat_id?: string;
}

export interface ProductResponse {
  prod_id: string;
  rest_id: string;
  cat_id: string;
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
    cat_id: p.cat_id.toString(),
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
  @Transform(trim)
  @IsString({ message: 'Enter the addon name as text.' })
  @Length(1, 150, {
    message: 'Addon name must be between 1 and 150 characters.',
  })
  addon_name!: string;

  @IsString({ message: 'Enter addon price as text, for example "10.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter addon price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  addon_price!: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class UpdateAddonDto {
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the addon name as text.' })
  @Length(1, 150, {
    message: 'Addon name must be between 1 and 150 characters.',
  })
  addon_name?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter addon price as text, for example "10.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter addon price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  addon_price?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export class ListAddonsQuery extends PaginationQuery {}

export class SetProductAddonDto {
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
  created_at: string;
  updated_at: string;
}

export function serializeAddon(a: Addon): AddonResponse {
  return {
    addon_id: a.addon_id.toString(),
    rest_id: a.rest_id.toString(),
    addon_name: a.addon_name,
    addon_price: a.addon_price,
    is_active: Boolean(a.is_active),
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
): ProductAddonResponse {
  return {
    rest_id: pa.rest_id.toString(),
    prod_id: pa.prod_id.toString(),
    addon_id: pa.addon_id.toString(),
    is_active: Boolean(pa.is_active),
    addon: serializeAddon(addon),
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
  @Transform(trim)
  @IsString({ message: 'Enter the offer title as text.' })
  @Length(1, 150, {
    message: 'Offer title must be between 1 and 150 characters.',
  })
  offer_title!: string;

  @IsOptional()
  @IsString({ message: 'Enter the offer description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  offer_description?: string | null;

  @IsString({ message: 'Enter initial price as text, for example "150.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter initial price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  initial_price!: string;

  @IsString({ message: 'Enter real price as text, for example "130.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter real price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  real_price!: string;

  @IsOptional()
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  offer_image_url?: string | null;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;

  @IsDateString(
    { strict: true },
    { message: 'Enter starts_at as a UTC ISO 8601 timestamp.' },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Include Z or an explicit timezone offset in the start time.',
  })
  starts_at!: string;

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
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the offer title as text.' })
  @Length(1, 150, {
    message: 'Offer title must be between 1 and 150 characters.',
  })
  offer_title?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsString({ message: 'Enter the offer description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  offer_description?: string | null;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter initial price as text, for example "150.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter initial price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  initial_price?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter real price as text, for example "130.00".' })
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message:
      'Enter real price as a decimal amount with up to 10 whole digits and 2 decimal places.',
  })
  real_price?: string;

  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  offer_image_url?: string | null;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;

  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsDateString(
    { strict: true },
    { message: 'Enter starts_at as a UTC ISO 8601 timestamp.' },
  )
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'Include Z or an explicit timezone offset in the start time.',
  })
  starts_at?: string;

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
