import { Controller, Get, Query } from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { RestaurantAnalyticsService } from './restaurant-analytics.service';
import { RestaurantAnalyticsQuery } from './orders.dto';

@Controller('restaurant/analytics')
export class RestaurantAnalyticsController {
  constructor(private readonly analytics: RestaurantAnalyticsService) {}

  @Get('')
  async overview(
    @CurrentActor() actor: AuthActor,
    @Query() query: RestaurantAnalyticsQuery,
  ) {
    return reply(await this.analytics.overview(actor, query.range ?? '30d'));
  }
}
