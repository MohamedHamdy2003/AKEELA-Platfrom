import { Controller, Get, Query } from '@nestjs/common';
import { PublicRoute } from '../../common/http/public-route.decorator';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
import { ListPublicOffersFeedQuery } from './offers-feed.dto';
import { OffersFeedService } from './offers-feed.service';

@Controller('offers')
@PublicRoute()
export class PublicOffersController {
  constructor(private readonly offersFeed: OffersFeedService) {}

  @Get()
  async list(@Query() query: ListPublicOffersFeedQuery) {
    const pagination = resolvePagination(query);
    const { items, total } = await this.offersFeed.listPublicOffersFeed({
      skip: pagination.skip,
      take: pagination.take,
      openOnly: query.open_only,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items,
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }
}
