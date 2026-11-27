import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  PublicCategoryResponse,
  PublicOfferResponse,
  PublicProductResponse,
  PublicRestaurantResponse,
} from './catalog.dto';

export const SEARCH_TYPES = [
  'all',
  'restaurants',
  'products',
  'offers',
  'categories',
] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export type SearchMatchSource =
  'name' | 'description' | 'category' | 'product' | 'offer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const parseOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
};

export class GlobalSearchQuery {
  @ApiProperty({
    type: 'string',
    description:
      'Search query matched against active restaurants, products, offers, and categories with Arabic normalization and typo tolerance.',
    minLength: 1,
    maxLength: 100,
    example: 'شاورما',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter a search term as text.' })
  @Length(1, 100, {
    message: 'Search query must be between 1 and 100 characters.',
  })
  q!: string;

  @ApiProperty({
    type: 'string',
    enum: SEARCH_TYPES,
    description:
      'Optional section filter. Defaults to "all" (searches restaurants, products, offers, and categories in parallel).',
    default: 'all',
    required: false,
  })
  @IsOptional()
  @Transform(trim)
  @IsIn(SEARCH_TYPES, {
    message:
      'type must be one of: all, restaurants, products, offers, categories.',
  })
  type?: SearchType;

  @ApiProperty({
    type: 'integer',
    description:
      'Maximum number of results returned per section (1 to 50). Defaults to 10.',
    minimum: 1,
    maximum: 50,
    default: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(50, { message: 'limit cannot exceed 50.' })
  limit?: number;

  @ApiProperty({
    type: 'boolean',
    description:
      'When true, restrict results to restaurants currently open in Africa/Cairo time.',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean({ message: 'open_only must be true or false.' })
  open_only?: boolean;

  @ApiProperty({
    type: 'string',
    description:
      'Optional restaurant ID (positive BIGINT string) to scope search results to a single active restaurant menu.',
    pattern: '^[1-9]\\d{0,18}$',
    example: '10',
    required: false,
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'rest_id must be a positive integer string.' })
  @Matches(/^[1-9]\d{0,18}$/, {
    message: 'rest_id must be a positive integer.',
  })
  rest_id?: string;
}

export interface SearchRestaurantResult extends PublicRestaurantResponse {
  matched_in: SearchMatchSource[];
  matching_items_count: number;
}

export interface SearchProductResult extends PublicProductResponse {
  rest_id: string;
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
  cat_title: string;
}

export interface SearchOfferResult extends PublicOfferResponse {
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
}

export interface SearchCategoryResult extends PublicCategoryResponse {
  rest_id: string;
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
}

export interface GlobalSearchCounts {
  restaurants: number;
  products: number;
  offers: number;
  categories: number;
}

export interface GlobalSearchResponse {
  query: string;
  normalized_query: string;
  type: SearchType;
  counts: GlobalSearchCounts;
  restaurants: SearchRestaurantResult[];
  products: SearchProductResult[];
  offers: SearchOfferResult[];
  categories: SearchCategoryResult[];
}
