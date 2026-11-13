import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQuery } from '../users/admin.dto';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateDriverDto {
  @Transform(trim)
  @IsString()
  @Length(1, 150, {
    message: 'Driver name must be between 1 and 150 characters.',
  })
  driver_name!: string;
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code (8-15 digits). ',
  })
  driver_phone!: string;
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'Enter a valid driver email address.' })
  @MaxLength(254)
  driver_email?: string | null;
  @IsOptional()
  @IsBoolean({ message: 'Driver activity must be true or false.' })
  is_active?: boolean;
}
export class UpdateDriverDto {
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  driver_name?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code (8-15 digits).',
  })
  driver_phone?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined && v !== null)
  @Transform(trim)
  @IsEmail({}, { message: 'Enter a valid driver email address.' })
  @MaxLength(254)
  driver_email?: string | null;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean()
  is_active?: boolean;
}
export class UpdateCompanyDto {
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  company_name?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code (8-15 digits).',
  })
  company_phone?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined && v !== null)
  @Transform(trim)
  @IsEmail({}, { message: 'Enter a valid company email address.' })
  @MaxLength(254)
  company_email?: string | null;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  company_address?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsBoolean({ message: 'Company activity must be true or false.' })
  is_active?: boolean;
}
export class ListDriversQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: 'Driver activity must be true or false.',
  })
  is_active?: 'true' | 'false';
}
export function serializeCompany(
  p: import('./entities/delivery-company-profile.entity').DeliveryCompanyProfile,
) {
  return {
    company_id: p.company_id,
    user_id: p.user_id,
    company_name: p.company_name,
    company_phone: p.company_phone,
    company_email: p.company_email,
    company_address: p.company_address,
    is_active: p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}
export function serializeDriver(
  d: import('./entities/delivery-driver.entity').DeliveryDriver,
) {
  return {
    driver_id: d.driver_id,
    company_id: d.company_id,
    driver_name: d.driver_name,
    driver_phone: d.driver_phone,
    driver_email: d.driver_email,
    is_active: d.is_active,
    created_at: d.created_at,
    updated_at: d.updated_at,
  };
}
