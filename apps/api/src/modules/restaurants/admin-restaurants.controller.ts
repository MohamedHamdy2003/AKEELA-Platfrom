import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  CurrentActor,
  AuthActor,
} from '../../common/http/current-actor.decorator';
import {
  ListRestaurantsQuery,
  SetActivationDto,
  paginationMeta,
  resolvePagination,
} from '../users/admin.dto';
import { RestaurantsService } from './restaurants.service';

@Controller('admin/restaurants')
export class AdminRestaurantsController {
  constructor(private readonly restaurants: RestaurantsService) {}

  private assertAdmin(actor: AuthActor): void {
    if (actor.role !== 'Admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
    }
  }

  @Get()
  async list(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListRestaurantsQuery,
  ) {
    this.assertAdmin(actor);
    const pagination = resolvePagination(query);
    const { items, total } = await this.restaurants.listForReview({
      activation_status: query.activation_status,
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items,
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Patch(':rest_id/activation')
  @HttpCode(200)
  async setActivation(
    @CurrentActor() actor: AuthActor,
    @Param('rest_id') restId: string,
    @Body() input: SetActivationDto,
  ) {
    this.assertAdmin(actor);
    const updated = await this.restaurants.setActivation(
      restId,
      input.activation_status,
    );
    return reply(updated, 'Activation status updated.');
  }
}
