import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class EmailDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email must be 254 characters or fewer.' })
  email!: string;
}
export class RegisterDto extends EmailDto {
  @Transform(trim)
  @IsString({ message: 'Enter your full name as text.' })
  @Length(1, 150, {
    message: 'Full name must be between 1 and 150 characters.',
  })
  full_name!: string;
  @IsString({ message: 'Enter your password as text.' })
  @Length(8, 128, { message: 'Password must be between 8 and 128 characters.' })
  @Matches(/(?=.*\p{L})(?=.*\p{Nd})/su, {
    message: 'Password must contain at least one letter and one digit.',
  })
  password!: string;
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  phone!: string;
}
export class RestaurantProfileDto {
  @Transform(trim)
  @IsString({ message: 'Enter the restaurant name as text.' })
  @Length(1, 150, {
    message: 'Restaurant name must be between 1 and 150 characters.',
  })
  rest_title!: string;
  @IsOptional()
  @IsString({ message: 'Enter the restaurant description as text.' })
  @MaxLength(10000, {
    message: 'Description must be 10,000 characters or fewer.',
  })
  rest_description?: string | null;
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  rest_image_url_mobile?: string | null;
  @Transform(trim)
  @IsString({ message: 'Enter the restaurant address as text.' })
  @Length(1, 2000, {
    message: 'Address must be between 1 and 2,000 characters.',
  })
  rest_address!: string;
  @IsString({ message: 'Enter longitude as text, for example "32.2723".' })
  @IsLongitude({ message: 'Longitude must be between -180 and 180.' })
  @Matches(/^-?\d{1,3}(\.\d{1,7})?$/, {
    message: 'Enter longitude as a decimal number with up to 7 decimal places.',
  })
  longitude!: string;
  @IsString({ message: 'Enter latitude as text, for example "30.5965".' })
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Enter latitude as a decimal number with up to 7 decimal places.',
  })
  latitude!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message:
      'Enter opening time in 24-hour HH:mm:ss format, for example 10:00:00.',
  })
  opens_at!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message:
      'Enter closing time in 24-hour HH:mm:ss format, for example 22:00:00.',
  })
  closes_at!: string;
}
export class RestaurantRegisterDto extends RegisterDto {
  @IsDefined({ message: 'Restaurant details are required.' })
  @ValidateNested({ message: 'Enter restaurant details as an object.' })
  @Type(() => RestaurantProfileDto)
  profile!: RestaurantProfileDto;
}
export class OtpDto extends EmailDto {
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your email.' })
  otp!: string;
}
export class ResetPasswordDto extends OtpDto {
  @IsString({ message: 'Enter your new password as text.' })
  @Length(8, 128, {
    message: 'New password must be between 8 and 128 characters.',
  })
  @Matches(/(?=.*\p{L})(?=.*\p{Nd})/su, {
    message: 'Password must contain at least one letter and one digit.',
  })
  new_password!: string;
}
export class LoginDto extends EmailDto {
  @IsString({ message: 'Enter your password as text.' })
  @Length(1, 128, { message: 'Enter your password (up to 128 characters).' })
  password!: string;
}
export class RefreshDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'Your session could not be refreshed. Please log in again.',
  })
  refresh_token!: string;
}
export class PatchMeDto {
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter your full name as text.' })
  @Length(1, 150, {
    message: 'Full name must be between 1 and 150 characters.',
  })
  full_name?: string;
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  phone?: string;
  @IsOptional()
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter an image link starting with http:// or https://.' },
  )
  @MaxLength(2048, { message: 'Image link must be 2,048 characters or fewer.' })
  cus_avatar_url?: string | null;
}
export class ChangePasswordDto {
  @IsString({ message: 'Enter your current password as text.' })
  @Length(1, 128, {
    message: 'Enter your current password (up to 128 characters).',
  })
  current_password!: string;
  @IsString({ message: 'Enter your new password as text.' })
  @Length(8, 128, {
    message: 'New password must be between 8 and 128 characters.',
  })
  @Matches(/(?=.*\p{L})(?=.*\p{Nd})/su, {
    message: 'Password must contain at least one letter and one digit.',
  })
  new_password!: string;
}
