import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationQuery } from '../users/admin.dto';
import { PublicOfferResponse } from './catalog.dto';

const parseOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return value;
};

export class ListPublicOffersFeedQuery extends PaginationQuery {
  @ApiProperty({
    type: 'boolean',
    description:
      'When true, restrict offers to restaurants currently open in Africa/Cairo time.',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean({ message: 'open_only must be true or false.' })
  open_only?: boolean;
}

export interface PublicOfferFeedItemResponse extends PublicOfferResponse {
  rest_title: string;
  rest_image_url_mobile: string | null;
  is_open: boolean;
  discount_percentage: number;
  orders_count: number;
}
