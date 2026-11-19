import { ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDefined,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class AddonChoiceDto {
  @ApiProperty({
    type: 'string',
    description:
      'Positive PostgreSQL BIGINT ID as a decimal string (maximum 9223372036854775807).',
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: true,
  })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid addon ID.' })
  addon_id!: string;
  @ApiProperty({
    type: 'integer',
    description:
      'Total number of units. Addon quantity is the total for the entire cart line, not per product.',
    minimum: 1,
    maximum: 2147483647,
    example: 1,
    required: true,
  })
  @IsInt({ message: 'Addon quantity must be a whole number.' })
  @Min(1, { message: 'Addon quantity must be positive.' })
  @Max(2147483647, { message: 'Quantity exceeds the supported integer range.' })
  quantity!: number;
}
export class AddCartItemDto {
  @ApiProperty({
    type: 'string',
    description:
      'Positive PostgreSQL BIGINT ID as a decimal string (maximum 9223372036854775807).',
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: true,
  })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid restaurant ID.' })
  rest_id!: string;
  @ApiProperty({
    type: 'string',
    description: 'Product ID. Send exactly one non-null prod_id or offer_id.',
    nullable: true,
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: false,
  })
  @IsOptional()
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid product ID.' })
  prod_id?: string | null;
  @ApiProperty({
    type: 'string',
    description:
      'Offer ID. Send exactly one non-null prod_id or offer_id. Offers do not accept addons.',
    nullable: true,
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: false,
  })
  @IsOptional()
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid offer ID.' })
  offer_id?: string | null;
  @ApiProperty({
    type: 'integer',
    description:
      'Total number of units. Addon quantity is the total for the entire cart line, not per product.',
    minimum: 1,
    maximum: 2147483647,
    example: 1,
    required: true,
  })
  @IsInt({ message: 'Quantity must be a whole number.' })
  @Min(1, { message: 'Quantity must be positive.' })
  @Max(2147483647, { message: 'Quantity exceeds the supported integer range.' })
  quantity!: number;
  @ApiProperty({
    description:
      'Addon selection for a product only; unique addon IDs. On PATCH this replaces the whole selection; [] clears it. Omit to keep the selection.',
    required: false,
    nullable: false,
    type: () => [AddonChoiceDto],
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray({ message: 'Addons must be a list.' })
  @ArrayUnique((item: AddonChoiceDto) => item?.addon_id, {
    message: 'Choose each addon only once.',
  })
  @ValidateNested({ each: true })
  @Type(() => AddonChoiceDto)
  addons?: AddonChoiceDto[];
}
export class UpdateCartItemDto {
  @ApiProperty({
    type: 'integer',
    description:
      'Total number of units; 0 removes this cart line. Addon quantity is the total for the entire cart line, not per product.',
    minimum: 0,
    maximum: 2147483647,
    example: 1,
    required: false,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt({ message: 'Quantity must be a whole number.' })
  @Min(0, { message: 'Quantity cannot be negative.' })
  @Max(2147483647, { message: 'Quantity exceeds the supported integer range.' })
  quantity?: number;
  @ApiProperty({
    description:
      'Addon selection for a product only; unique addon IDs. On PATCH this replaces the whole selection; [] clears it. Omit to keep the selection.',
    required: false,
    nullable: false,
    type: () => [AddonChoiceDto],
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsArray({ message: 'Addons must be a list.' })
  @ArrayUnique((item: AddonChoiceDto) => item?.addon_id, {
    message: 'Choose each addon only once.',
  })
  @ValidateNested({ each: true })
  @Type(() => AddonChoiceDto)
  addons?: AddonChoiceDto[];
}
export class DeliveryAddressDto {
  @ApiProperty({
    type: 'string',
    description: 'address line.',
    minLength: 1,
    maxLength: 2000,
    example: '12 Main Street, Ismailia',
    required: true,
  })
  @Transform(trim)
  @IsString()
  @Length(1, 2000, {
    message: 'Address must be between 1 and 2,000 characters.',
  })
  address_line!: string;
  @ApiProperty({
    type: 'string',
    description:
      'Longitude as a decimal string, -180 to 180, at most 7 decimal places.',
    example: '32.2723000',
    required: true,
  })
  @IsString()
  @IsLongitude({ message: 'Longitude must be between -180 and 180.' })
  @Matches(/^-?\d{1,3}(\.\d{1,7})?$/, {
    message: 'Use up to 7 decimal places for longitude.',
  })
  longitude!: string;
  @ApiProperty({
    type: 'string',
    description:
      'Latitude as a decimal string, -90 to 90, at most 7 decimal places.',
    example: '30.5965000',
    required: true,
  })
  @IsString()
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Use up to 7 decimal places for latitude.',
  })
  latitude!: string;
}
export class QuoteDto {
  @ApiProperty({
    type: 'string',
    description:
      'An address owned by the current customer. Send exactly one of address_id or delivery_address.',
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: false,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid saved address ID.' })
  address_id?: string;
  @ApiProperty({
    description:
      'One-time delivery address; stored only in the order snapshot. Send exactly one of this object or address_id.',
    required: false,
    nullable: false,
    type: () => DeliveryAddressDto,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsDefined({ message: 'Enter the delivery address.' })
  @IsObject({ message: 'Enter delivery address as one object.' })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery_address?: DeliveryAddressDto;
}
