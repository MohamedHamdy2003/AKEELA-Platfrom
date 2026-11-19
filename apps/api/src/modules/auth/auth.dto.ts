import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
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
  @ApiProperty({
    type: 'string',
    description: 'Account login email; trimmed and converted to lowercase.',
    format: 'email',
    maxLength: 254,
    example: 'ahmed@example.com',
    required: true,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254, { message: 'Email must be 254 characters or fewer.' })
  email!: string;
}
export class RegisterDto extends EmailDto {
  @ApiProperty({
    type: 'string',
    description: 'full name.',
    minLength: 1,
    maxLength: 150,
    example: 'Ahmed Ali',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter your full name as text.' })
  @Length(1, 150, {
    message: 'Full name must be between 1 and 150 characters.',
  })
  full_name!: string;
  @ApiProperty({
    type: 'string',
    description:
      '8–128 characters, with at least one letter and one digit. Never log this value.',
    minLength: 8,
    maxLength: 128,
    example: 'ExamplePassword2026',
    required: true,
  })
  @IsString({ message: 'Enter your password as text.' })
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
}
export class RestaurantProfileDto {
  @ApiProperty({
    type: 'string',
    description: 'rest title.',
    minLength: 1,
    maxLength: 150,
    example: 'AKEELA Kitchen',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the restaurant name as text.' })
  @Length(1, 150, {
    message: 'Restaurant name must be between 1 and 150 characters.',
  })
  rest_title!: string;
  @ApiProperty({
    type: 'string',
    description: 'rest description.',
    nullable: true,
    maxLength: 10000,
    required: false,
  })
  @IsOptional()
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
  @IsOptional()
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
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the restaurant address as text.' })
  @Length(1, 2000, {
    message: 'Address must be between 1 and 2,000 characters.',
  })
  rest_address!: string;
  @ApiProperty({
    type: 'string',
    description:
      'Longitude as a decimal string, -180 to 180, at most 7 decimal places.',
    example: '32.2723000',
    required: true,
  })
  @IsString({ message: 'Enter longitude as text, for example "32.2723".' })
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
  @IsString({ message: 'Enter latitude as text, for example "30.5965".' })
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Enter latitude as a decimal number with up to 7 decimal places.',
  })
  latitude!: string;
  @ApiProperty({
    type: 'string',
    description: 'Opening time in Africa/Cairo, 24-hour HH:mm:ss.',
    example: '10:00:00',
    required: true,
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message:
      'Enter opening time in 24-hour HH:mm:ss format, for example 10:00:00.',
  })
  opens_at!: string;
  @ApiProperty({
    type: 'string',
    description:
      'Closing time in Africa/Cairo, 24-hour HH:mm:ss. Closing earlier than opening means overnight service.',
    example: '02:00:00',
    required: true,
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, {
    message:
      'Enter closing time in 24-hour HH:mm:ss format, for example 22:00:00.',
  })
  closes_at!: string;
}
export class RestaurantRegisterDto extends RegisterDto {
  @ApiProperty({
    description: 'Role-specific profile. Send one object, never an array.',
    required: true,
    nullable: false,
    type: () => RestaurantProfileDto,
  })
  @IsDefined({ message: 'Restaurant details are required.' })
  @IsObject({ message: 'Enter restaurant details as one object.' })
  @ValidateNested({ message: 'Enter restaurant details as an object.' })
  @Type(() => RestaurantProfileDto)
  profile!: RestaurantProfileDto;
}
export class OtpDto extends EmailDto {
  @ApiProperty({
    type: 'string',
    description:
      'Six-digit email code. Keep leading zeros. Default lifetime 10 minutes, 5 attempts; resend after 60 seconds.',
    minLength: 6,
    maxLength: 6,
    pattern: '^[0-9]{6}$',
    example: '123456',
    required: true,
  })
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your email.' })
  otp!: string;
}
export class ResetPasswordDto extends OtpDto {
  @ApiProperty({
    type: 'string',
    description:
      '8–128 characters, with at least one letter and one digit. Replaces the password and revokes all sessions.',
    minLength: 8,
    maxLength: 128,
    example: 'NewPassword2026',
    required: true,
  })
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
  @ApiProperty({
    type: 'string',
    description:
      '8–128 characters, with at least one letter and one digit. Never log this value.',
    minLength: 1,
    maxLength: 128,
    example: 'ExamplePassword2026',
    required: true,
  })
  @IsString({ message: 'Enter your password as text.' })
  @Length(1, 128, { message: 'Enter your password (up to 128 characters).' })
  password!: string;
}
export class RefreshDto {
  @ApiProperty({
    type: 'string',
    description:
      'Opaque refresh token returned by login/refresh. Rotates on use; replace both tokens after each refresh.',
    minLength: 43,
    maxLength: 43,
    pattern: '^[A-Za-z0-9_-]{43}$',
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    required: true,
  })
  @Matches(/^[A-Za-z0-9_-]{43}$/, {
    message: 'Your session could not be refreshed. Please log in again.',
  })
  refresh_token!: string;
}
export class PatchMeDto {
  @ApiProperty({
    type: 'string',
    description: 'full name.',
    minLength: 1,
    maxLength: 150,
    example: 'Ahmed Ali',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString({ message: 'Enter your full name as text.' })
  @Length(1, 150, {
    message: 'Full name must be between 1 and 150 characters.',
  })
  full_name?: string;
  @ApiProperty({
    type: 'string',
    description:
      'International phone number starting with + and country code; 8–15 digits.',
    pattern: '^\\+[1-9]\\d{7,14}$',
    example: '+201000000001',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message:
      'Enter a phone number starting with + and the country code, followed by digits only (8–15 digits in total).',
  })
  phone?: string;
  @ApiProperty({
    type: 'string',
    description:
      'Customer avatar URL only. Other roles cannot edit this field. Null clears it.',
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
  cus_avatar_url?: string | null;
}
export class ChangePasswordDto {
  @ApiProperty({
    type: 'string',
    description: 'Current account password. Never log this value.',
    minLength: 1,
    maxLength: 128,
    example: 'ExamplePassword2026',
    required: true,
  })
  @IsString({ message: 'Enter your current password as text.' })
  @Length(1, 128, {
    message: 'Enter your current password (up to 128 characters).',
  })
  current_password!: string;
  @ApiProperty({
    type: 'string',
    description:
      '8–128 characters, with at least one letter and one digit. Replaces the password and revokes all sessions.',
    minLength: 8,
    maxLength: 128,
    example: 'NewPassword2026',
    required: true,
  })
  @IsString({ message: 'Enter your new password as text.' })
  @Length(8, 128, {
    message: 'New password must be between 8 and 128 characters.',
  })
  @Matches(/(?=.*\p{L})(?=.*\p{Nd})/su, {
    message: 'Password must contain at least one letter and one digit.',
  })
  new_password!: string;
}
