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
  CreateCategoryDto,
  ListCategoriesQuery,
  UpdateCategoryDto,
  serializeCategory,
} from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('restaurant/categories')
export class RestaurantCategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  private assertRestaurant(actor: AuthActor): void {
    if (actor.role !== 'Restaurant') {
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    }
  }

  @Get()
  async list(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListCategoriesQuery,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const pagination = resolvePagination(query);
    const { items, total } = await this.catalog.listCategories(
      profile.rest_id,
      {
        skip: pagination.skip,
        take: pagination.take,
      },
    );
    return {
      success: true,
      message: 'Records returned.',
      data: items.map(serializeCategory),
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Post()
  async create(
    @CurrentActor() actor: AuthActor,
    @Body() body: CreateCategoryDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const category = await this.catalog.createCategory(profile.rest_id, body);
    return reply(serializeCategory(category), 'Category created.');
  }

  @Patch(':cat_id')
  @HttpCode(200)
  async update(
    @CurrentActor() actor: AuthActor,
    @Param('cat_id') catId: string,
    @Body() body: UpdateCategoryDto,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    const category = await this.catalog.updateCategory(
      profile.rest_id,
      catId,
      body,
    );
    return reply(serializeCategory(category), 'Category updated.');
  }
}
