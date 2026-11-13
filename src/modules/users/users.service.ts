import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { User } from './entities/user.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { Account, NewAccount, Role } from './account.types';

export interface UserListFilters {
  role?: Role;
  is_active?: boolean;
  page: number;
  per_page: number;
}

export type ProfileResolver = (account: Account) => Promise<unknown>;

@Injectable()
export class UsersService {
  private profileResolver?: ProfileResolver;

  constructor(private readonly dataSource: DataSource) {}

  registerProfileResolver(resolver: ProfileResolver): void {
    this.profileResolver = resolver;
  }

  async resolveProfile(account: Account): Promise<unknown> {
    if (this.profileResolver) {
      return this.profileResolver(account);
    }
    if (account.role === 'Admin') {
      return this.adminProfile(account.user_id);
    }
    return null;
  }

  safeUser(account: Account, profile?: unknown) {
    return {
      user_id: account.user_id,
      full_name: account.full_name,
      email: account.email,
      phone: account.phone_number,
      role: account.role,
      is_active: account.is_active,
      email_verified_at: account.email_verified_at,
      profile: profile ?? null,
      created_at: account.created_at,
      updated_at: account.updated_at,
    };
  }

  async activeVerifiedRestaurantIds(): Promise<string[]> {
    const users = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .select(['u.user_id'])
      .where(
        "u.role = 'Restaurant' AND u.is_active = true AND u.email_verified_at IS NOT NULL",
      )
      .getMany();
    return users.map((user) => user.user_id);
  }

  async create(input: NewAccount, manager: EntityManager): Promise<Account> {
    return manager
      .getRepository(User)
      .save(manager.getRepository(User).create(input));
  }

  async byEmail(
    email: string,
    manager = this.dataSource.manager,
  ): Promise<Account | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.email = :email', { email })
      .getOne();
  }

  async byId(
    id: string,
    manager = this.dataSource.manager,
    lock = false,
  ): Promise<Account | null> {
    const query = manager
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.password_hash')
      .where('u.user_id = :id', { id });
    if (lock) query.setLock('pessimistic_write');
    return query.getOne();
  }

  async update(
    id: string,
    fields: Partial<
      Pick<
        Account,
        | 'full_name'
        | 'phone_number'
        | 'password_hash'
        | 'email_verified_at'
        | 'is_active'
      >
    >,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(User).update({ user_id: id }, fields);
  }

  async adminProfile(id: string, manager = this.dataSource.manager) {
    return manager.getRepository(AdminProfile).findOneBy({ user_id: id });
  }

  async createAdminProfile(
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(AdminProfile)
      .save(manager.getRepository(AdminProfile).create({ user_id: userId }));
  }

  async listUsers(
    filters: UserListFilters,
    manager = this.dataSource.manager,
  ): Promise<{ items: unknown[]; total: number }> {
    const qb = manager
      .getRepository(User)
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC');
    if (filters.role !== undefined) {
      qb.andWhere('u.role = :role', { role: filters.role });
    }
    if (filters.is_active !== undefined) {
      qb.andWhere('u.is_active = :is_active', { is_active: filters.is_active });
    }
    const total = await qb.getCount();
    const accounts = await qb
      .skip((filters.page - 1) * filters.per_page)
      .take(filters.per_page)
      .getMany();

    const items = await Promise.all(
      accounts.map(async (account) => {
        const profile = await this.resolveProfile(account);
        return this.safeUser(account, profile);
      }),
    );
    return { items, total };
  }

  async getUser(userId: string): Promise<unknown> {
    const account = await this.byId(userId);
    if (!account) {
      throw new ApiError(404, 'NOT_FOUND', 'Account not found.');
    }
    const profile = await this.resolveProfile(account);
    return this.safeUser(account, profile);
  }

  async setActivity(userId: string, is_active: boolean): Promise<unknown> {
    const account = await this.dataSource.transaction(async (manager) => {
      const target = await this.byId(userId, manager, true);
      if (!target) {
        throw new ApiError(404, 'NOT_FOUND', 'Account not found.');
      }
      if (target.role === 'Delivery_Company' && !is_active)
        throw new ApiError(
          409,
          'CONFLICT',
          'Delivery company accounts cannot be disabled in the single-company version.',
        );
      if (target.role === 'Admin' && !is_active) {
        throw new ApiError(
          409,
          'CONFLICT',
          'The Admin account cannot be disabled.',
        );
      }
      await this.update(userId, { is_active }, manager);
      return (await this.byId(userId, manager))!;
    });
    const profile = await this.resolveProfile(account);
    return this.safeUser(account, profile);
  }
}
