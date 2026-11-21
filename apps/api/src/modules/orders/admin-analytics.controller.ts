import { Controller, Get, Query } from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsQuery } from './orders.dto';

@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('')
  async overview(
    @CurrentActor() actor: AuthActor,
    @Query() query: AdminAnalyticsQuery,
  ) {
    return reply(await this.analytics.overview(actor, query.range ?? '30d'));
  }
}
