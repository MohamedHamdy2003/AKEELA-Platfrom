import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { RestaurantProfile } from './entities/restaurant-profile.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateRestaurantProfileDto {
  @ApiProperty({
    type: 'string',
    description: 'rest title.',
    minLength: 1,
    maxLength: 150,
    example: 'AKEELA Kitchen',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the restaurant name as text.' })
  @Length(1, 150, {
    message: 'Restaurant name must be between 1 and 150 characters.',
  })
  rest_title?: string;

  @ApiProperty({
    type: 'string',
    description: 'rest description.',
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @IsString({ message: 'Enter the restaurant description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  rest_description?: string | null;

  @ApiProperty({
    type: 'string',
    description:
      'Public image URL representing the restaurant in the mobile application. Null clears it.',
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
  rest_image_url_mobile?: string | null;

  @ApiProperty({
    type: 'string',
    description: 'rest address.',
    minLength: 1,
    maxLength: 2000,
    example: '12 Main Street, Ismailia',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter the restaurant address as text.' })
  @Length(1, 2000, {
    message: 'Address must be between 1 and 2,000 characters.',
  })
  rest_address?: string;

  @ApiProperty({
    type: 'string',
    description:
      'Longitude as a decimal string, -180 to 180, at most 7 decimal places.',
    example: '32.2723000',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsString({ message: 'Enter longitude as text, for example "32.2723".' })
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
  @IsString({ message: 'Enter latitude as text, for example "30.5965".' })
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Enter latitude as a decimal number with up to 7 decimal places.',
  })
  latitude?: string;

  @ApiProperty({
    type: 'string',
    description: 'Opening time in Africa/Cairo, 24-hour HH:mm:ss.',
    example: '10:00:00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message:
      'Enter opening time in 24-hour HH:mm:ss format, for example 10:00:00.',
  })
  opens_at?: string;

  @ApiProperty({
    type: 'string',
    description:
      'Closing time in Africa/Cairo, 24-hour HH:mm:ss. Closing earlier than opening means overnight service.',
    example: '02:00:00',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message:
      'Enter closing time in 24-hour HH:mm:ss format, for example 22:00:00.',
  })
  closes_at?: string;

  @ApiProperty({ type: 'boolean', description: 'is active.', required: false })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @IsBoolean({ message: 'is_active must be true or false.' })
  is_active?: boolean;
}

export interface RestaurantProfileResponse {
  rest_id: string;
  rest_title: string;
  rest_description: string | null;
  rest_image_url_mobile: string | null;
  rest_address: string;
  longitude: string;
  latitude: string;
  opens_at: string;
  closes_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  activation_status: 'Pending' | 'Active' | 'Suspended';
}

export interface RestaurantDashboardResponse {
  rest_id: string;
  activation_status: 'Pending' | 'Active' | 'Suspended';
  can_manage: boolean;
  message: string;
}

export function serializeRestaurantProfile(
  profile: RestaurantProfile,
): RestaurantProfileResponse {
  return {
    rest_id: profile.rest_id.toString(),
    rest_title: profile.rest_title,
    rest_description: profile.rest_description ?? null,
    rest_image_url_mobile: profile.rest_image_url_mobile ?? null,
    rest_address: profile.rest_address,
    longitude: profile.longitude.toString(),
    latitude: profile.latitude.toString(),
    opens_at: profile.opens_at,
    closes_at: profile.closes_at,
    is_active: Boolean(profile.is_active),
    created_at:
      profile.created_at instanceof Date
        ? profile.created_at.toISOString()
        : new Date(profile.created_at).toISOString(),
    updated_at:
      profile.updated_at instanceof Date
        ? profile.updated_at.toISOString()
        : new Date(profile.updated_at).toISOString(),
    activation_status: profile.activation_status,
  };
}
