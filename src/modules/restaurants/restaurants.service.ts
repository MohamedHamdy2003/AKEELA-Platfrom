import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { UsersService } from '../users/users.service';
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

export interface RestaurantListFilters {
  activation_status?: 'Pending' | 'Active' | 'Suspended';
  page: number;
  per_page: number;
}

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
  ) {}

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

  async profileById(
    restId: string,
    manager = this.dataSource.manager,
    lock = false,
  ): Promise<RestaurantProfile | null> {
    const qb = manager
      .getRepository(RestaurantProfile)
      .createQueryBuilder('r')
      .where('r.rest_id = :restId', { restId });
    if (lock) qb.setLock('pessimistic_write');
    return qb.getOne();
  }

  async listForReview(
    filters: RestaurantListFilters,
    manager = this.dataSource.manager,
  ): Promise<{ items: unknown[]; total: number }> {
    const qb = manager
      .getRepository(RestaurantProfile)
      .createQueryBuilder('r')
      .orderBy('r.created_at', 'DESC');
    if (filters.activation_status !== undefined) {
      qb.andWhere('r.activation_status = :activation_status', {
        activation_status: filters.activation_status,
      });
    }
    const total = await qb.getCount();
    const profiles = await qb
      .skip((filters.page - 1) * filters.per_page)
      .take(filters.per_page)
      .getMany();

    const items = await Promise.all(
      profiles.map(async (p) => {
        const owner = await this.users.byId(p.user_id, manager);
        return {
          owner: owner
            ? {
                user_id: owner.user_id,
                full_name: owner.full_name,
                email: owner.email,
                phone: owner.phone_number,
                email_verified_at: owner.email_verified_at,
                is_active: owner.is_active,
              }
            : null,
          profile: p,
        };
      }),
    );
    return { items, total };
  }

  async setActivation(
    restId: string,
    activation_status: 'Active' | 'Suspended',
  ): Promise<RestaurantProfile> {
    return this.dataSource.transaction(async (manager) => {
      const existing = await this.profileById(restId, manager, true);
      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Restaurant not found.');
      }
      await manager
        .getRepository(RestaurantProfile)
        .update({ rest_id: restId }, { activation_status });
      return (await this.profileById(restId, manager))!;
    });
  }
}
