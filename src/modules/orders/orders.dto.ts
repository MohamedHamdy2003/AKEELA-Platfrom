import {
  IsIn,
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
