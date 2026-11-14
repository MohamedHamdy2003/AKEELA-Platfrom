import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { ApiError, reply } from '../../common/http/api-error';
import { OrdersService } from './orders.service';
import { CheckoutDto, ListOrdersQuery } from './orders.dto';
@Controller('customer/orders')
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}
  private customer(a: AuthActor) {
    if (a.role !== 'Customer')
      throw new ApiError(403, 'FORBIDDEN', 'Customer access required.');
    return a.userId;
  }
  @Post() async checkout(
    @CurrentActor() a: AuthActor,
    @Body() input: CheckoutDto,
  ) {
    return reply(
      await this.orders.checkout(this.customer(a), input),
      'Order placed.',
    );
  }
  @Get() async list(
    @CurrentActor() a: AuthActor,
    @Query() query: ListOrdersQuery,
  ) {
    const result = await this.orders.list(this.customer(a), query);
    return { ...reply(result.items), meta: result.meta };
  }
  @Get(':order_id') async get(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
  ) {
    return reply(await this.orders.details(this.customer(a), id));
  }
  @Post(':order_id/cancel') @HttpCode(200) async cancel(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
  ) {
    return reply(
      await this.orders.cancel(this.customer(a), id),
      'Order cancelled.',
    );
  }
}
