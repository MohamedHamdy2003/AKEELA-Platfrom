import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { CustomerAddress } from './entities/customer-address.entity';
import { PaginationQuery } from '../users/admin.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAddressDto {
  @ApiProperty({
    type: 'string',
    description: 'address title.',
    minLength: 1,
    maxLength: 100,
    example: 'Home',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the address title as text.' })
  @Length(1, 100, {
    message: 'Address title must be between 1 and 100 characters.',
  })
  address_title!: string;

  @ApiProperty({
    type: 'string',
    description: 'address line.',
    minLength: 1,
    maxLength: 2000,
    example: '12 Main Street, Ismailia',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the address line as text.' })
  @Length(1, 2000, {
    message: 'Address line must be between 1 and 2,000 characters.',
  })
  address_line!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Longitude as a decimal string, -180 to 180, at most 7 decimal places.',
    example: '32.2723000',
    required: true,
  })
  @IsString({ message: 'Enter longitude as text, for example "32.2800".' })
  @IsLongitude({ message: 'Longitude must be between -180 and 180.' })
  @Matches(/^-?\d{1,3}(\.\d{1,7})?$/, {
    message: 'Enter longitude as a decimal number with up to 7 decimal places.',
  })
  longitude!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Latitude as a decimal string, -90 to 90, at most 7 decimal places.',
    example: '30.5965000',
    required: true,
  })
  @IsString({ message: 'Enter latitude as text, for example "30.6000".' })
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Enter latitude as a decimal number with up to 7 decimal places.',
  })
  latitude!: string;

  @ApiProperty({
    type: 'boolean',
    description: 'is default.',
    nullable: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_default must be true or false.' })
  is_default?: boolean;
}

export class UpdateAddressDto {
  @ApiProperty({
    type: 'string',
    description: 'address title.',
    minLength: 1,
    maxLength: 100,
    example: 'Home',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the address title as text.' })
  @Length(1, 100, {
    message: 'Address title must be between 1 and 100 characters.',
  })
  address_title?: string;

  @ApiProperty({
    type: 'string',
    description: 'address line.',
    minLength: 1,
    maxLength: 2000,
    example: '12 Main Street, Ismailia',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the address line as text.' })
  @Length(1, 2000, {
    message: 'Address line must be between 1 and 2,000 characters.',
  })
  address_line?: string;

  @ApiProperty({
    type: 'string',
    description:
      'Longitude as a decimal string, -180 to 180, at most 7 decimal places.',
    example: '32.2723000',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter longitude as text, for example "32.2800".' })
  @IsLongitude({ message: 'Longitude must be between -180 and 180.' })
  @Matches(/^-?\d{1,3}(\.\d{1,7})?$/, {
    message: 'Enter longitude as a decimal number with up to 7 decimal places.',
  })
  longitude?: string;

  @ApiProperty({
    type: 'string',
    description:
      'Latitude as a decimal string, -90 to 90, at most 7 decimal places.',
    example: '30.5965000',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter latitude as text, for example "30.6000".' })
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Enter latitude as a decimal number with up to 7 decimal places.',
  })
  latitude?: string;

  @ApiProperty({ type: 'boolean', description: 'is default.', required: false })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_default must be true or false.' })
  is_default?: boolean;
}

export class ListAddressesQuery extends PaginationQuery {}

export interface AddressResponse {
  address_id: string;
  user_id: string;
  address_title: string;
  address_line: string;
  longitude: string;
  latitude: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function serializeAddress(address: CustomerAddress): AddressResponse {
  return {
    address_id: address.address_id.toString(),
    user_id: address.user_id.toString(),
    address_title: address.address_title,
    address_line: address.address_line,
    longitude: address.longitude.toString(),
    latitude: address.latitude.toString(),
    is_default: Boolean(address.is_default),
    created_at:
      address.created_at instanceof Date
        ? address.created_at.toISOString()
        : new Date(address.created_at).toISOString(),
    updated_at:
      address.updated_at instanceof Date
        ? address.updated_at.toISOString()
        : new Date(address.updated_at).toISOString(),
  };
}
