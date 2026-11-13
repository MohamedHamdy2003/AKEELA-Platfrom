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
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid addon ID.' })
  addon_id!: string;
  @IsInt({ message: 'Addon quantity must be a whole number.' })
  @Min(1, { message: 'Addon quantity must be positive.' })
  @Max(2147483647, { message: 'Quantity exceeds the supported integer range.' })
  quantity!: number;
}
export class AddCartItemDto {
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid restaurant ID.' })
  rest_id!: string;
  @IsOptional()
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid product ID.' })
  prod_id?: string | null;
  @IsOptional()
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid offer ID.' })
  offer_id?: string | null;
  @IsInt({ message: 'Quantity must be a whole number.' })
  @Min(1, { message: 'Quantity must be positive.' })
  @Max(2147483647, { message: 'Quantity exceeds the supported integer range.' })
  quantity!: number;
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
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsInt({ message: 'Quantity must be a whole number.' })
  @Min(0, { message: 'Quantity cannot be negative.' })
  @Max(2147483647, { message: 'Quantity exceeds the supported integer range.' })
  quantity?: number;
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
  @Transform(trim)
  @IsString()
  @Length(1, 2000, {
    message: 'Address must be between 1 and 2,000 characters.',
  })
  address_line!: string;
  @IsString()
  @IsLongitude({ message: 'Longitude must be between -180 and 180.' })
  @Matches(/^-?\d{1,3}(\.\d{1,7})?$/, {
    message: 'Use up to 7 decimal places for longitude.',
  })
  longitude!: string;
  @IsString()
  @IsLatitude({ message: 'Latitude must be between -90 and 90.' })
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/, {
    message: 'Use up to 7 decimal places for latitude.',
  })
  latitude!: string;
}
export class QuoteDto {
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid saved address ID.' })
  address_id?: string;
  @ValidateIf((_o, v: unknown) => v !== undefined)
  @IsDefined({ message: 'Enter the delivery address.' })
  @IsObject({ message: 'Enter delivery address as one object.' })
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery_address?: DeliveryAddressDto;
}
