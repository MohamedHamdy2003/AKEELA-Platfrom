import { Controller, Get, Query } from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { DeliveryAnalyticsService } from './delivery-analytics.service';
import { DeliveryAnalyticsQuery } from './orders.dto';

@Controller('delivery-company/analytics')
export class DeliveryAnalyticsController {
  constructor(private readonly analytics: DeliveryAnalyticsService) {}

  @Get('')
  async overview(
    @CurrentActor() actor: AuthActor,
    @Query() query: DeliveryAnalyticsQuery,
  ) {
    return reply(await this.analytics.overview(actor, query.range ?? '30d'));
  }
}
