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
  @ValidateIf((_o, v: unknown) => v !== undefined && v !== null)
  @IsString({ message: 'Enter notes as text.' })
  @MaxLength(10000, { message: 'Notes must be 10,000 characters or fewer.' })
  notes?: string | null;
}
export class ListOrdersQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(['active', 'history'], { message: 'Choose active or history.' })
  scope?: 'active' | 'history';
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: 'Choose a valid order status.' })
  status?: OrderStatus;
}

export class OperationalOrdersQuery extends PaginationQuery {
  @IsOptional()
  @IsIn(ORDER_STATUSES, { message: 'Choose a valid order status.' })
  status?: OrderStatus;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Use YYYY-MM-DD for the start date.',
  })
  @IsDateString({ strict: true }, { message: 'Enter a valid start date.' })
  date_from?: string;
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Use YYYY-MM-DD for the end date.',
  })
  @IsDateString({ strict: true }, { message: 'Enter a valid end date.' })
  date_to?: string;
}
export class AssignDriverDto {
  @Matches(/^[1-9]\d{0,18}$/, { message: 'Enter a valid driver ID.' })
  driver_id!: string;
}
export class EmptyOrderActionDto {}
