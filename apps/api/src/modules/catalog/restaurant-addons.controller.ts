import {
  Body,
  Controller,
  Delete,
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
    const { items, total, linkedProductIds } = await this.catalog.listAddons(
      profile.rest_id,
      {
        unlinked: query.unlinked,
        skip: pagination.skip,
        take: pagination.take,
      },
    );
    return {
      success: true,
      message: 'Records returned.',
      data: items.map((a) =>
        serializeAddon(a, linkedProductIds.get(a.addon_id.toString()) ?? []),
      ),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Post()
  async create(@CurrentActor() actor: AuthActor, @Body() body: CreateAddonDto) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const addon = await this.catalog.createAddon(profile.rest_id, body);
    return reply(serializeAddon(addon, []), 'Addon created.');
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
    const { addon, linkedProductIds } = await this.catalog.updateAddon(
      profile.rest_id,
      addonId,
      body,
    );
    return reply(serializeAddon(addon, linkedProductIds), 'Addon updated.');
  }

  @Delete(':addon_id')
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: AuthActor,
    @Param('addon_id') addonId: string,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    await this.catalog.deleteAddon(profile.rest_id, addonId);
    return reply(null, 'Addon deleted.');
  }
}
