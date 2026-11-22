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
    const { items, total, productCounts } = await this.catalog.listCategories(
      profile.rest_id,
      {
        skip: pagination.skip,
        take: pagination.take,
      },
    );
    return {
      success: true,
      message: 'Records returned.',
      data: items.map((c) =>
        serializeCategory(c, productCounts.get(c.cat_id.toString()) ?? 0),
      ),
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
    return reply(serializeCategory(category, 0), 'Category created.');
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
    const { category, productCount } = await this.catalog.updateCategory(
      profile.rest_id,
      catId,
      body,
    );
    return reply(
      serializeCategory(category, productCount),
      'Category updated.',
    );
  }

  @Delete(':cat_id')
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: AuthActor,
    @Param('cat_id') catId: string,
  ) {
    this.assertRestaurant(actor);
    const profile = await this.catalog.assertActiveRestaurant(actor.userId);
    await this.catalog.deleteCategory(profile.rest_id, catId);
    return reply(null, 'Category deleted.');
  }
}
