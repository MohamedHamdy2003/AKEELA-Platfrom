import { Body, Controller, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import {
  RestaurantDashboardResponse,
  RestaurantProfileResponse,
  UpdateRestaurantProfileDto,
  serializeRestaurantProfile,
} from './restaurants.dto';
import { RestaurantsService } from './restaurants.service';

@Controller('restaurant')
export class RestaurantProfileController {
  constructor(private readonly restaurants: RestaurantsService) {}

  private assertRestaurant(actor: AuthActor): void {
    if (actor.role !== 'Restaurant') {
      throw new ApiError(403, 'FORBIDDEN', 'Restaurant access required.');
    }
  }

  @Get('profile')
  async getProfile(
    @CurrentActor() actor: AuthActor,
  ): Promise<{ success: boolean; data: RestaurantProfileResponse }> {
    this.assertRestaurant(actor);
    const profile = await this.restaurants.getProfile(actor.userId);
    return reply(serializeRestaurantProfile(profile));
  }

  @Get('dashboard')
  async getDashboard(
    @CurrentActor() actor: AuthActor,
  ): Promise<{ success: boolean; data: RestaurantDashboardResponse }> {
    this.assertRestaurant(actor);
    const dashboard = await this.restaurants.getDashboard(actor.userId);
    return reply(dashboard);
  }

  @Patch('profile')
  @HttpCode(200)
  async updateProfile(
    @CurrentActor() actor: AuthActor,
    @Body() input: UpdateRestaurantProfileDto,
  ): Promise<{
    success: boolean;
    data: RestaurantProfileResponse;
    message: string;
  }> {
    this.assertRestaurant(actor);
    const updated = await this.restaurants.updateProfile(actor.userId, input);
    return reply(
      serializeRestaurantProfile(updated),
      'Restaurant profile updated.',
    );
  }
}
