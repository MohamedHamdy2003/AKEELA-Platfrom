import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsDateString,
  Matches,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { QuoteDto } from '../cart/cart.dto';
import { PaginationQuery } from '../users/admin.dto';
import { ORDER_STATUSES, OrderStatus } from './entities/order.entity';
export class CheckoutDto extends QuoteDto {
  @ApiProperty({
    type: 'string',
    description: 'notes.',
    nullable: true,
    maxLength: 10000,
    example: 'Call on arrival',
    required: false,
  })
  @ValidateIf((_o, v: unknown) => v !== undefined && v !== null)
  @IsString({ message: 'Enter notes as text.' })
  @MaxLength(10000, { message: 'Notes must be 10,000 characters or fewer.' })
  notes?: string | null;
}
export class ListOrdersQuery extends PaginationQuery {
  @ApiProperty({
    type: 'string',
    description:
      'active: Pending, Accepted, Picked_Up; history: Delivered, Rejected, Cancelled, Failed.',
    nullable: true,
    enum: ['active', 'history'],
    required: false,
  })
  @IsOptional()
  @IsIn(['active', 'history'], { message: 'Choose active or history.' })
  scope?: 'active' | 'history';
  @ApiProperty({
    type: 'string',
    description: 'status.',
    nullable: true,
    enum: [
      'Pending',
      'Accepted',
      'Picked_Up',
      'Delivered',
      'Rejected',
      'Cancelled',
      'Failed',
    ],
    required: false,
  })
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: 'Choose a valid order status.' })
  status?: OrderStatus;
}

export class OperationalOrdersQuery extends PaginationQuery {
  @ApiProperty({
    type: 'string',
    description: 'status.',
    nullable: true,
    enum: [
      'Pending',
      'Accepted',
      'Picked_Up',
      'Delivered',
      'Rejected',
      'Cancelled',
      'Failed',
    ],
    required: false,
  })
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: 'Choose a valid order status.' })
  status?: OrderStatus;
  @ApiProperty({
    type: 'string',
    description:
      'Inclusive start of this calendar day in Africa/Cairo (YYYY-MM-DD). Must not follow date_to.',
    nullable: true,
    format: 'date',
    example: '2026-11-01',
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Use YYYY-MM-DD for the start date.',
  })
  @IsDateString({ strict: true }, { message: 'Enter a valid start date.' })
  date_from?: string;
  @ApiProperty({
    type: 'string',
    description:
      'Inclusive end of this calendar day in Africa/Cairo (YYYY-MM-DD).',
    nullable: true,
    format: 'date',
    example: '2026-11-30',
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Use YYYY-MM-DD for the end date.',
  })
  @IsDateString({ strict: true }, { message: 'Enter a valid end date.' })
  date_to?: string;
}
export class AssignDriverDto {
  @ApiProperty({
    type: 'string',
    description:
      'Positive PostgreSQL BIGINT ID as a decimal string (maximum 9223372036854775807).',
    pattern: '^[1-9]\\d{0,18}$',
    example: '1',
    required: true,
  })
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid driver ID.' })
  driver_id!: string;
}
export class EmptyOrderActionDto {}

export const ANALYTICS_RANGES = ['today', '7d', '30d', '90d', 'all'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export class AdminAnalyticsQuery {
  @ApiProperty({
    type: 'string',
    description:
      'Analytics window in Africa/Cairo time: today, 7d, 30d (default), 90d, or all.',
    enum: ['today', '7d', '30d', '90d', 'all'],
    required: false,
    nullable: true,
    example: '30d',
  })
  @IsOptional()
  @IsIn(ANALYTICS_RANGES, {
    message: 'Choose today, 7d, 30d, 90d, or all.',
  })
  range?: AnalyticsRange;
}

export class DeliveryAnalyticsQuery {
  @ApiProperty({
    type: 'string',
    description:
      'Delivery analytics window in Africa/Cairo time: today, 7d, 30d (default), 90d, or all.',
    enum: ['today', '7d', '30d', '90d', 'all'],
    required: false,
    nullable: true,
    example: '30d',
  })
  @IsOptional()
  @IsIn(ANALYTICS_RANGES, {
    message: 'Choose today, 7d, 30d, 90d, or all.',
  })
  range?: AnalyticsRange;
}

export class RestaurantAnalyticsQuery {
  @ApiProperty({
    type: 'string',
    description:
      'Restaurant analytics window in Africa/Cairo time: today, 7d, 30d (default), 90d, or all.',
    enum: ['today', '7d', '30d', '90d', 'all'],
    required: false,
    nullable: true,
    example: '30d',
  })
  @IsOptional()
  @IsIn(ANALYTICS_RANGES, {
    message: 'Choose today, 7d, 30d, 90d, or all.',
  })
  range?: AnalyticsRange;
}
