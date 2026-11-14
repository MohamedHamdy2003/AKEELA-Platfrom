import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { ApiError, reply } from '../../common/http/api-error';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto, QuoteDto } from './cart.dto';
@Controller('customer/cart')
export class CartController {
  constructor(private readonly cart: CartService) {}
  private customer(a: AuthActor) {
    if (a.role !== 'Customer')
      throw new ApiError(403, 'FORBIDDEN', 'Customer access required.');
    return a.userId;
  }
  @Get() async get(@CurrentActor() a: AuthActor) {
    return reply(await this.cart.get(this.customer(a)));
  }
  @Post('items') async add(
    @CurrentActor() a: AuthActor,
    @Body() dto: AddCartItemDto,
  ) {
    return reply(await this.cart.add(this.customer(a), dto));
  }
  @Patch('items/:cart_item_id') async update(
    @CurrentActor() a: AuthActor,
    @Param('cart_item_id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return reply(await this.cart.update(this.customer(a), id, dto));
  }
  @Delete('items/:cart_item_id') async remove(
    @CurrentActor() a: AuthActor,
    @Param('cart_item_id') id: string,
  ) {
    return reply(await this.cart.remove(this.customer(a), id));
  }
  @Delete() async clear(@CurrentActor() a: AuthActor) {
    return reply(await this.cart.clear(this.customer(a)));
  }
  @Post('quote') @HttpCode(200) async quote(
    @CurrentActor() a: AuthActor,
    @Body() dto: QuoteDto,
  ) {
    return reply(await this.cart.quote(this.customer(a), dto));
  }
}
