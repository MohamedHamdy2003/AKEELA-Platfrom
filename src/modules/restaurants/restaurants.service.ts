import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { UsersService } from '../users/users.service';
import { RestaurantProfile } from './entities/restaurant-profile.entity';
import {
  RestaurantDashboardResponse,
  UpdateRestaurantProfileDto,
} from './restaurants.dto';

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

  async listPublic(pagination: { skip: number; take: number }) {
    const ids = await this.users.activeVerifiedRestaurantIds();
    if (!ids.length) return { items: [], total: 0 };
    const [items, total] = await this.dataSource
      .getRepository(RestaurantProfile)
      .findAndCount({
        where: {
          user_id: In(ids),
          activation_status: 'Active',
          is_active: true,
        },
        order: { created_at: 'DESC', rest_id: 'DESC' },
        ...pagination,
      });
    return { items, total };
  }

  async getPublic(restId: string): Promise<RestaurantProfile> {
    const profile = await this.profileById(restId);
    const owner = profile ? await this.users.byId(profile.user_id) : null;
    if (
      !profile ||
      profile.activation_status !== 'Active' ||
      !profile.is_active ||
      !owner?.is_active ||
      !owner.email_verified_at
    )
      throw new ApiError(404, 'NOT_FOUND', 'Restaurant not found.');
    return profile;
  }

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

  async getProfile(
    userId: string,
    manager = this.dataSource.manager,
  ): Promise<RestaurantProfile> {
    const profile = await this.profile(userId, manager);
    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Restaurant profile not found.');
    }
    return profile;
  }

  async getDashboard(userId: string): Promise<RestaurantDashboardResponse> {
    const user = await this.users.byId(userId);
    const profile = await this.profile(userId);
    if (!profile) {
      throw new ApiError(404, 'NOT_FOUND', 'Restaurant profile not found.');
    }
    const isUserActive = Boolean(user?.is_active);
    const isEmailVerified = Boolean(user?.email_verified_at);
    const canManage =
      profile.activation_status === 'Active' && isUserActive && isEmailVerified;

    let message: string;
    if (profile.activation_status === 'Pending') {
      message = 'Your restaurant is waiting for Admin activation.';
    } else if (profile.activation_status === 'Suspended') {
      message = 'Your restaurant is suspended by Admin.';
    } else if (!canManage) {
      message = 'Your account is not active or verified.';
    } else {
      message = 'Your restaurant is active and ready to manage.';
    }

    return {
      rest_id: profile.rest_id.toString(),
      activation_status: profile.activation_status,
      can_manage: canManage,
      message,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateRestaurantProfileDto,
  ): Promise<RestaurantProfile> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RestaurantProfile);
      const profile = await repo
        .createQueryBuilder('r')
        .where('r.user_id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();

      if (!profile) {
        throw new ApiError(404, 'NOT_FOUND', 'Restaurant profile not found.');
      }

      const opens = input.opens_at ?? profile.opens_at;
      const closes = input.closes_at ?? profile.closes_at;
      if (opens === closes) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Opening and closing times must differ.',
          { closes_at: ['Must differ from opens_at.'] },
        );
      }

      if (input.rest_title !== undefined) profile.rest_title = input.rest_title;
      if (input.rest_description !== undefined)
        profile.rest_description = input.rest_description;
      if (input.rest_image_url_mobile !== undefined)
        profile.rest_image_url_mobile = input.rest_image_url_mobile;
      if (input.rest_address !== undefined)
        profile.rest_address = input.rest_address;
      if (input.longitude !== undefined) profile.longitude = input.longitude;
      if (input.latitude !== undefined) profile.latitude = input.latitude;
      if (input.opens_at !== undefined) profile.opens_at = input.opens_at;
      if (input.closes_at !== undefined) profile.closes_at = input.closes_at;
      if (input.is_active !== undefined) profile.is_active = input.is_active;

      return repo.save(profile);
    });
  }
}
