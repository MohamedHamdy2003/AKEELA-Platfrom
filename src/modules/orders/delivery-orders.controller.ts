import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { OrdersService } from './orders.service';
import {
  OperationalOrdersQuery,
  AssignDriverDto,
  EmptyOrderActionDto,
} from './orders.dto';
@Controller('delivery-company/orders')
export class DeliveryOrdersController {
  constructor(private readonly orders: OrdersService) {}
  private actor(a: AuthActor) {
    if (a.role !== 'Delivery_Company')
      throw new ApiError(403, 'FORBIDDEN', 'Delivery_Company access required.');
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
  @Put(':order_id/driver')
  async driver(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
    @Body() input: AssignDriverDto,
  ) {
    return reply(
      await this.orders.assignDriver(this.actor(a), id, input.driver_id),
    );
  }
  @Post(':order_id/pickup')
  @HttpCode(200)
  async pickup(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
    @Body() _input: EmptyOrderActionDto,
  ) {
    void _input;
    return reply(await this.orders.deliveryAction(this.actor(a), id, true));
  }
  @Post(':order_id/deliver')
  @HttpCode(200)
  async deliver(
    @CurrentActor() a: AuthActor,
    @Param('order_id') id: string,
    @Body() _input: EmptyOrderActionDto,
  ) {
    void _input;
    return reply(await this.orders.deliveryAction(this.actor(a), id, false));
  }
}
