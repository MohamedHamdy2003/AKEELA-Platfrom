import { Controller, Get, Query } from '@nestjs/common';
import { PublicRoute } from '../../common/http/public-route.decorator';
import { GlobalSearchQuery } from './search.dto';
import { CatalogSearchService } from './search.service';

@Controller('search')
@PublicRoute()
export class PublicSearchController {
  constructor(private readonly searchService: CatalogSearchService) {}

  @Get()
  async search(@Query() query: GlobalSearchQuery) {
    const data = await this.searchService.search({
      q: query.q,
      type: query.type,
      limit: query.limit,
      openOnly: query.open_only,
      restId: query.rest_id,
    });
    return {
      success: true,
      message: 'Search results returned.',
      data,
    };
  }
}
