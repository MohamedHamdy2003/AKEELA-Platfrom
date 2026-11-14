import { Type } from 'class-transformer';
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

// ---- Shared pagination query ----
export class PaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number.' })
  @Min(1, { message: 'page must be at least 1.' })
  @Max(10000, { message: 'page is too large.' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'per_page must be a whole number.' })
  @Min(1, { message: 'per_page must be at least 1.' })
  @Max(100, { message: 'per_page cannot exceed 100.' })
  per_page: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number.' })
  @Min(1, { message: 'limit must be at least 1.' })
  @Max(100, { message: 'limit cannot exceed 100.' })
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'offset must be a whole number.' })
  @Min(0, { message: 'offset must be at least 0.' })
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
  @IsOptional()
  @IsIn(['Customer', 'Restaurant', 'Delivery_Company', 'Admin'], {
    message: 'role must be Customer, Restaurant, Delivery_Company, or Admin.',
  })
  role?: 'Customer' | 'Restaurant' | 'Delivery_Company' | 'Admin';

  @IsOptional()
  @IsIn(['true', 'false'], { message: 'is_active must be true or false.' })
  is_active?: string;
}

// ---- GET /admin/restaurants query ----
export class ListRestaurantsQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['Pending', 'Active', 'Suspended'], {
    message: 'activation_status must be Pending, Active, or Suspended.',
  })
  activation_status?: 'Pending' | 'Active' | 'Suspended';
}

// ---- Delivery_Company profile inside POST /admin/users ----
export class AdminCreateDeliveryProfileDto {
  @IsString({ message: 'Enter the company name as text.' })
  @Length(1, 150, {
    message: 'Company name must be between 1 and 150 characters.',
  })
  company_name!: string;

  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  company_phone!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid company email address.' })
  @MaxLength(254, {
    message: 'Company email must be 254 characters or fewer.',
  })
  company_email?: string | null;

  @IsString({ message: 'Enter the company address as text.' })
  @Length(1, 2000, {
    message: 'Company address must be between 1 and 2,000 characters.',
  })
  company_address!: string;

  @IsOptional()
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

// ---- POST /admin/users body ----
export class AdminCreateUserDto {
  @IsString({ message: 'Enter the full name as text.' })
  @Length(1, 150, {
    message: 'Full name must be between 1 and 150 characters.',
  })
  full_name!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email must be 254 characters or fewer.' })
  email!: string;

  @IsString({ message: 'Enter the password as text.' })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @Matches(/(?=.*\p{L})(?=.*\p{Nd})/su, {
    message: 'Password must contain at least one letter and one digit.',
  })
  password!: string;

  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  phone!: string;

  @IsIn(['Delivery_Company', 'Admin'], {
    message: 'role must be Delivery_Company or Admin.',
  })
  role!: 'Delivery_Company' | 'Admin';

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
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active!: boolean;
}

// ---- PATCH /admin/restaurants/{rest_id}/activation ----
export class SetActivationDto {
  @IsIn(['Active', 'Suspended'], {
    message: 'activation_status must be Active or Suspended.',
  })
  activation_status!: 'Active' | 'Suspended';
}
