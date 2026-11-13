import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { OrdersService } from './orders.service';
import { OperationalOrdersQuery, EmptyOrderActionDto } from './orders.dto';
@Controller('restaurant/orders')
export class RestaurantOrdersController {
  constructor(private readonly orders: OrdersService) {}
  private actor(a: AuthActor) {
    if (a.role !== 'Restaurant')
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    return a;
  }
  @Get('')
  async list(
    @CurrentActor() a: AuthActor,
    @Query() query: OperationalOrdersQuery,
  ) {
    const result = await this.orders.operationalList(this.actor(a), query);
    return { ...reply(result.items), meta: result.meta };
  }
  @Get(':order_id')
  async details(@CurrentActor() a: AuthActor, @Param('order_id') id: string) {
    return reply(await this.orders.operationalDetails(this.actor(a), id));
  }
  @Post(':order_id/accept')
  @HttpCode(200)
  async accept(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
    @Body() _input: EmptyOrderActionDto,
  ) {
    void _input;
    return reply(await this.orders.restaurantDecision(this.actor(a), id, true));
  }
  @Post(':order_id/reject')
  @HttpCode(200)
  async reject(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
    @Body() _input: EmptyOrderActionDto,
  ) {
    void _input;
    return reply(
      await this.orders.restaurantDecision(this.actor(a), id, false),
    );
  }
}
