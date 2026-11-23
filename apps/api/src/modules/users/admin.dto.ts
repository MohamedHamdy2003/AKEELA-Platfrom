import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsObject,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

// ---- Shared pagination query ----
export class PaginationQuery {
  @ApiProperty({
    type: 'integer',
    description:
      'Page number. Ignored for skip calculation when offset is provided.',
    nullable: true,
    minimum: 1,
    maximum: 10000,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number.' })
  @Min(1, { message: 'page must be at least 1.' })
  @Max(10000, { message: 'page is too large.' })
  page: number = 1;

  @ApiProperty({
    type: 'integer',
    description: 'Records per page. limit overrides this value.',
    nullable: true,
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'per_page must be a whole number.' })
  @Min(1, { message: 'per_page must be at least 1.' })
  @Max(100, { message: 'per_page cannot exceed 100.' })
  per_page: number = 20;

  @ApiProperty({
    type: 'integer',
    description: 'Optional pagination alias; overrides per_page.',
    nullable: true,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(100, { message: 'limit cannot exceed 100.' })
  limit?: number;

  @ApiProperty({
    type: 'integer',
    description:
      'Optional zero-based skip; overrides page and determines the returned page number.',
    nullable: true,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset must be a whole number.' })
  @Min(0, { message: 'offset must be at least 0.' })
  @Max(1000000, { message: 'offset is too large.' })
  offset?: number;
}

export function resolvePagination(query: PaginationQuery): {
  page: number;
  per_page: number;
  skip: number;
  take: number;
} {
  const per_page = query.limit ?? query.per_page ?? 20;
  let page = query.page ?? 1;
  let skip = (page - 1) * per_page;

  if (query.offset !== undefined) {
    skip = query.offset;
    page = Math.floor(skip / per_page) + 1;
  }

  return {
    page,
    per_page,
    skip,
    take: per_page,
  };
}

export function paginationMeta(total: number, page: number, per_page: number) {
  return {
    page,
    per_page,
    total,
    last_page: Math.max(1, Math.ceil(total / per_page)),
  };
}

// ---- GET /admin/users query ----
export class ListUsersQuery extends PaginationQuery {
  @ApiProperty({
    type: 'string',
    description: 'role.',
    nullable: true,
    enum: ['Customer', 'Restaurant', 'Delivery_Company', 'Admin'],
    required: false,
  })
  @IsOptional()
  @IsIn(['Customer', 'Restaurant', 'Delivery_Company', 'Admin'], {
    message: 'role must be Customer, Restaurant, Delivery_Company, or Admin.',
  })
  role?: 'Customer' | 'Restaurant' | 'Delivery_Company' | 'Admin';

  @ApiProperty({
    type: 'string',
    description: 'is active.',
    nullable: true,
    enum: ['true', 'false'],
    required: false,
  })
  @IsOptional()
  @IsIn(['true', 'false'], { message: 'is_active must be true or false.' })
  is_active?: string;
}

// ---- GET /admin/restaurants query ----
export class ListRestaurantsQuery extends PaginationQuery {
  @ApiProperty({
    type: 'string',
    description: 'activation status.',
    nullable: true,
    enum: ['Pending', 'Active', 'Suspended'],
    required: false,
  })
  @IsOptional()
  @IsIn(['Pending', 'Active', 'Suspended'], {
    message: 'activation_status must be Pending, Active, or Suspended.',
  })
  activation_status?: 'Pending' | 'Active' | 'Suspended';

  @ApiProperty({
    type: 'string',
    description:
      'Optional case-insensitive search term matched against restaurant title or owner full name.',
    nullable: true,
    maxLength: 150,
    required: false,
  })
  @IsOptional()
  @Transform(trim)
  @IsString({ message: 'Enter the search term as text.' })
  @MaxLength(150, {
    message: 'Search term must be 150 characters or fewer.',
  })
  search?: string;
}

// ---- Delivery_Company profile inside POST /admin/users ----
export class AdminCreateDeliveryProfileDto {
  @ApiProperty({
    type: 'string',
    description: 'company name.',
    minLength: 1,
    maxLength: 150,
    example: 'Local Delivery',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the company name as text.' })
  @Length(1, 150, {
    message: 'Company name must be between 1 and 150 characters.',
  })
  company_name!: string;

  @ApiProperty({
    type: 'string',
    description:
      'International phone number starting with + and country code; 8–15 digits.',
    pattern: '^\\+[1-9]\\d{7,14}$',
    example: '+201000000001',
    required: true,
  })
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  company_phone!: string;

  @ApiProperty({
    type: 'string',
    description: 'company email.',
    nullable: true,
    format: 'email',
    maxLength: 254,
    required: false,
  })
  @IsOptional()
  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid company email address.' })
  @MaxLength(254, {
    message: 'Company email must be 254 characters or fewer.',
  })
  company_email?: string | null;

  @ApiProperty({
    type: 'string',
    description: 'company address.',
    minLength: 1,
    maxLength: 2000,
    example: '5 Main Street, Ismailia',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the company address as text.' })
  @Length(1, 2000, {
    message: 'Company address must be between 1 and 2,000 characters.',
  })
  company_address!: string;

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

// ---- POST /admin/users body ----
export class AdminCreateUserDto {
  @ApiProperty({
    type: 'string',
    description: 'full name.',
    minLength: 1,
    maxLength: 150,
    example: 'Ahmed Ali',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the full name as text.' })
  @Length(1, 150, {
    message: 'Full name must be between 1 and 150 characters.',
  })
  full_name!: string;

  @ApiProperty({
    type: 'string',
    description: 'Account login email; trimmed and converted to lowercase.',
    format: 'email',
    maxLength: 254,
    example: 'ahmed@example.com',
    required: true,
  })
  @Transform(trimLower)
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email must be 254 characters or fewer.' })
  email!: string;

  @ApiProperty({
    type: 'string',
    description:
      '8–128 characters, with at least one letter and one digit. Never log this value.',
    minLength: 8,
    maxLength: 128,
    example: 'ExamplePassword2026',
    required: true,
  })
  @IsString({ message: 'Enter the password as text.' })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @Matches(/(?=.*\p{L})(?=.*\p{Nd})/su, {
    message: 'Password must contain at least one letter and one digit.',
  })
  password!: string;

  @ApiProperty({
    type: 'string',
    description:
      'International phone number starting with + and country code; 8–15 digits.',
    pattern: '^\\+[1-9]\\d{7,14}$',
    example: '+201000000001',
    required: true,
  })
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  phone!: string;

  @ApiProperty({
    type: 'string',
    description: 'role.',
    enum: ['Delivery_Company', 'Admin'],
    required: true,
  })
  @IsIn(['Delivery_Company', 'Admin'], {
    message: 'role must be Delivery_Company or Admin.',
  })
  role!: 'Delivery_Company' | 'Admin';

  @ApiProperty({
    description: 'Role-specific profile. Send one object, never an array.',
    required: false,
    nullable: false,
    type: () => AdminCreateDeliveryProfileDto,
  })
  @ValidateIf((o: AdminCreateUserDto) => o.role === 'Delivery_Company')
  @IsDefined({
    message: 'profile is required when creating a Delivery_Company account.',
  })
  @IsObject({ message: 'Enter profile details as one object.' })
  @ValidateNested({ message: 'Enter profile details as an object.' })
  @Type(() => AdminCreateDeliveryProfileDto)
  profile?: AdminCreateDeliveryProfileDto;
}

// ---- PATCH /admin/users/{user_id}/activity ----
export class SetActivityDto {
  @ApiProperty({ type: 'boolean', description: 'is active.', required: true })
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active!: boolean;
}

// ---- PATCH /admin/restaurants/{rest_id}/activation ----
export class SetActivationDto {
  @ApiProperty({
    type: 'string',
    description: 'activation status.',
    enum: ['Active', 'Suspended'],
    required: true,
  })
  @IsIn(['Active', 'Suspended'], {
    message: 'activation_status must be Active or Suspended.',
  })
  activation_status!: 'Active' | 'Suspended';
}
