import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  DEVICE_PLATFORMS,
  DevicePlatform,
} from './entities/device-token.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RegisterDeviceTokenDto {
  @ApiProperty({
    type: 'string',
    description:
      'Firebase Cloud Messaging (FCM) registration token issued by the client SDK.',
    minLength: 20,
    maxLength: 512,
    example: 'fcm_example_device_token_0123456789abcdefghijklmnopqrstuvwxyz',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the FCM device token as text.' })
  @Length(20, 512, {
    message: 'FCM token must be between 20 and 512 characters.',
  })
  fcm_token!: string;

  @ApiProperty({
    type: 'string',
    description: 'Client platform receiving push notifications.',
    enum: ['android', 'ios', 'web'],
    example: 'android',
    required: true,
  })
  @IsIn(DEVICE_PLATFORMS, {
    message: 'platform must be android, ios, or web.',
  })
  platform!: DevicePlatform;

  @ApiProperty({
    type: 'string',
    description: 'Optional human-readable device name.',
    nullable: true,
    maxLength: 100,
    example: 'Samsung Galaxy S24',
    required: false,
  })
  @ValidateIf((_o, value: unknown) => value !== undefined && value !== null)
  @Transform(trim)
  @IsString({ message: 'Enter the device label as text.' })
  @MaxLength(100, {
    message: 'Device label must be 100 characters or fewer.',
  })
  device_label?: string | null;
}

export class AdminSendNotificationDto {
  @ApiProperty({
    type: 'string',
    description: 'Push notification title.',
    minLength: 1,
    maxLength: 120,
    example: 'عرض جديد من أكيلة',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the notification title as text.' })
  @Length(1, 120, {
    message: 'Notification title must be between 1 and 120 characters.',
  })
  title!: string;

  @ApiProperty({
    type: 'string',
    description: 'Push notification body text.',
    minLength: 1,
    maxLength: 500,
    example: 'استمتع بخصم 20% على جميع طلبات المشويات اليوم.',
    required: true,
  })
  @Transform(trim)
  @IsString({ message: 'Enter the notification body as text.' })
  @Length(1, 500, {
    message: 'Notification body must be between 1 and 500 characters.',
  })
  body!: string;

  @ApiProperty({
    type: 'string',
    description:
      'Optional target user ID (BIGINT decimal string). Provide either user_id or role.',
    nullable: true,
    pattern: '^[1-9]\\d{0,18}$',
    example: '42',
    required: false,
  })
  @IsOptional()
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid user ID.' })
  user_id?: string;

  @ApiProperty({
    type: 'string',
    description:
      'Optional target user role for broadcast. Provide either user_id or role.',
    nullable: true,
    enum: ['Customer', 'Restaurant', 'Delivery_Company', 'Admin'],
    example: 'Customer',
    required: false,
  })
  @IsOptional()
  @IsIn(['Customer', 'Restaurant', 'Delivery_Company', 'Admin'], {
    message: 'role must be Customer, Restaurant, Delivery_Company, or Admin.',
  })
  role?: 'Customer' | 'Restaurant' | 'Delivery_Company' | 'Admin';

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    description:
      'Optional key-value string payload forwarded in the FCM data field for mobile deep-linking.',
    nullable: true,
    example: { screen: 'offers' },
  })
  @IsOptional()
  @IsObject({ message: 'data must be an object of string values.' })
  data?: Record<string, string>;
}
