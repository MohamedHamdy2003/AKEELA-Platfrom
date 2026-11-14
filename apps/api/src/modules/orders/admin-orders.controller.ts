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
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}
  private actor(a: AuthActor) {
    if (a.role !== 'Admin')
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
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
  @Post(':order_id/fail')
  @HttpCode(200)
  async fail(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
    @Body() _input: EmptyOrderActionDto,
  ) {
    void _input;
    return reply(await this.orders.fail(this.actor(a), id));
  }
}
