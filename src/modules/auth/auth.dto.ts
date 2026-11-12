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
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
export class RegisterDto extends EmailDto {
  @Transform(trim) @IsString() @Length(1, 150) full_name!: string;
  @IsString() @Length(12, 128) password!: string;
  @Transform(trim) @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
}
export class RestaurantProfileDto {
  @Transform(trim) @IsString() @Length(1, 150) rest_title!: string;
  @IsOptional() @IsString() @MaxLength(10000) rest_description?: string | null;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  rest_image_url_mobile?: string | null;
  @Transform(trim) @IsString() @Length(1, 2000) rest_address!: string;
  @IsString()
  @IsLongitude()
  @Matches(/^-?\d{1,3}(\.\d{1,7})?$/)
  longitude!: string;
  @IsString()
  @IsLatitude()
  @Matches(/^-?\d{1,2}(\.\d{1,7})?$/)
  latitude!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/) opens_at!: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/) closes_at!: string;
}
export class RestaurantRegisterDto extends RegisterDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => RestaurantProfileDto)
  profile!: RestaurantProfileDto;
}
export class OtpDto extends EmailDto {
  @Matches(/^\d{6}$/) otp!: string;
}
export class ResetPasswordDto extends OtpDto {
  @IsString() @Length(12, 128) new_password!: string;
}
export class LoginDto extends EmailDto {
  @IsString() @Length(1, 128) password!: string;
}
export class RefreshDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/) refresh_token!: string;
}
export class PatchMeDto {
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(1, 150)
  full_name?: string;
  @ValidateIf((_o, value: unknown) => value !== undefined)
  @Transform(trim)
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone?: string;
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  cus_avatar_url?: string | null;
}
export class ChangePasswordDto {
  @IsString() @Length(1, 128) current_password!: string;
  @IsString() @Length(12, 128) new_password!: string;
}
