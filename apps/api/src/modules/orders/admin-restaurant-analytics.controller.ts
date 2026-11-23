import { Controller, Get, Param, Query } from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { AdminRestaurantAnalyticsQuery } from './orders.dto';
import { RestaurantAnalyticsService } from './restaurant-analytics.service';

@Controller('admin/restaurants')
export class AdminRestaurantAnalyticsController {
  constructor(private readonly analytics: RestaurantAnalyticsService) {}

  @Get(':rest_id/analytics')
  async overview(
    @CurrentActor() actor: AuthActor,
    @Param('rest_id') restId: string,
    @Query() query: AdminRestaurantAnalyticsQuery,
  ) {
    return reply(await this.analytics.adminOverview(actor, restId, query));
  }
}
