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
  CreateAddonDto,
  ListAddonsQuery,
  UpdateAddonDto,
  serializeAddon,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('restaurant/addons')
export class RestaurantAddonsController {
  constructor(private readonly catalog: CatalogService) {}

  private assertRestaurant(actor: AuthActor): void {
    if (actor.role !== 'Restaurant') {
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    }
  }

  @Get()
  async list(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListAddonsQuery,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listAddons(profile.rest_id, {
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializeAddon),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Post()
  async create(@CurrentActor() actor: AuthActor, @Body() body: CreateAddonDto) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const addon = await this.catalog.createAddon(profile.rest_id, body);
    return reply(serializeAddon(addon), 'Addon created.');
  }

  @Patch(':addon_id')
  @HttpCode(200)
  async update(
    @CurrentActor() actor: AuthActor,
    @Param('addon_id') addonId: string,
    @Body() body: UpdateAddonDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const addon = await this.catalog.updateAddon(
      profile.rest_id,
      addonId,
      body,
    );
    return reply(serializeAddon(addon), 'Addon updated.');
  }
}
