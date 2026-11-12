import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { RestaurantProfile } from './entities/restaurant-profile.entity';
export interface RestaurantRegistration {
  rest_title: string;
  rest_description?: string | null;
  rest_image_url_mobile?: string | null;
  rest_address: string;
  longitude: string;
  latitude: string;
  opens_at: string;
  closes_at: string;
}
@Injectable()
export class RestaurantsService {
  constructor(private readonly dataSource: DataSource) {}
  async create(
    userId: string,
    input: RestaurantRegistration,
    manager: EntityManager,
  ) {
    return manager.getRepository(RestaurantProfile).save(
      manager.getRepository(RestaurantProfile).create({
        ...input,
        user_id: userId,
        activation_status: 'Pending',
        is_active: true,
      }),
    );
  }
  async profile(userId: string, manager = this.dataSource.manager) {
    return manager
      .getRepository(RestaurantProfile)
      .findOneBy({ user_id: userId });
  }
}
