import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
import {
  CreateOfferDto,
  ListOffersQuery,
  UpdateOfferDto,
  serializeOffer,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('restaurant/offers')
export class RestaurantOffersController {
  constructor(private readonly catalog: CatalogService) {}

  private assertRestaurant(actor: AuthActor): void {
    if (actor.role !== 'Restaurant') {
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    }
  }

  @Get()
  async list(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListOffersQuery,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listOffers(profile.rest_id, {
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializeOffer),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Post()
  async create(@CurrentActor() actor: AuthActor, @Body() body: CreateOfferDto) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const offer = await this.catalog.createOffer(profile.rest_id, body);
    return reply(serializeOffer(offer), 'Offer created.');
  }

  @Patch(':offer_id')
  @HttpCode(200)
  async update(
    @CurrentActor() actor: AuthActor,
    @Param('offer_id') offerId: string,
    @Body() body: UpdateOfferDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const offer = await this.catalog.updateOffer(
      profile.rest_id,
      offerId,
      body,
    );
    return reply(serializeOffer(offer), 'Offer updated.');
  }
}
