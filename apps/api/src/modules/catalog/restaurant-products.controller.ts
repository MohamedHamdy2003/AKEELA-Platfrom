import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
import {
  CreateProductDto,
  ListRestaurantProductsQuery,
  SetProductAddonDto,
  UpdateProductDto,
  serializeProduct,
  serializeProductAddon,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('restaurant/products')
export class RestaurantProductsController {
  constructor(private readonly catalog: CatalogService) {}

  private assertRestaurant(actor: AuthActor): void {
    if (actor.role !== 'Restaurant') {
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    }
  }

  @Get()
  async list(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListRestaurantProductsQuery,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listProducts(profile.rest_id, {
      cat_id: query.cat_id,
      unlinked: query.unlinked,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializeProduct),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Get(':prod_id')
  async getById(
    @CurrentActor() actor: AuthActor,
    @Param('prod_id') prodId: string,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const product = await this.catalog.getProduct(profile.rest_id, prodId);
    return reply(serializeProduct(product));
  }

  @Post()
  async create(
    @CurrentActor() actor: AuthActor,
    @Body() body: CreateProductDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const product = await this.catalog.createProduct(profile.rest_id, body);
    return reply(serializeProduct(product), 'Product created.');
  }

  @Patch(':prod_id')
  @HttpCode(200)
  async update(
    @CurrentActor() actor: AuthActor,
    @Param('prod_id') prodId: string,
    @Body() body: UpdateProductDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const product = await this.catalog.updateProduct(
      profile.rest_id,
      prodId,
      body,
    );
    return reply(serializeProduct(product), 'Product updated.');
  }

  @Delete(':prod_id')
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: AuthActor,
    @Param('prod_id') prodId: string,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    await this.catalog.deleteProduct(profile.rest_id, prodId);
    return reply(null, 'Product deleted.');
  }

  @Get(':prod_id/addons')
  async listProductAddons(
    @CurrentActor() actor: AuthActor,
    @Param('prod_id') prodId: string,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const items = await this.catalog.listProductAddons(profile.rest_id, prodId);
    return reply(
      items.map(({ link, addon, linkedProductIds }) =>
        serializeProductAddon(link, addon, linkedProductIds),
      ),
      'Records returned.',
    );
  }

  @Put(':prod_id/addons/:addon_id')
  @HttpCode(200)
  async setProductAddon(
    @CurrentActor() actor: AuthActor,
    @Param('prod_id') prodId: string,
    @Param('addon_id') addonId: string,
    @Body() body: SetProductAddonDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const { link, addon, linkedProductIds } =
      await this.catalog.setProductAddon(
        profile.rest_id,
        prodId,
        addonId,
        body,
      );
    return reply(
      serializeProductAddon(link, addon, linkedProductIds),
      'Product addon updated.',
    );
  }
}
