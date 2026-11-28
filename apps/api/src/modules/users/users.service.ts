import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { User } from './entities/user.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { Account, NewAccount, Role } from './account.types';

export interface UserListFilters {
  role?: Role;
  is_active?: boolean;
  skip?: number;
  take?: number;
}

export type ProfileResolver = (
  account: Account,
  manager?: EntityManager,
) => Promise<unknown>;
export type BatchProfileResolver = (
  accounts: Account[],
  manager?: EntityManager,
) => Promise<Map<string, unknown>>;

@Injectable()
export class UsersService {
  private profileResolver?: ProfileResolver;
  private batchProfileResolver?: BatchProfileResolver;

  constructor(private readonly dataSource: DataSource) {}

  registerProfileResolver(resolver: ProfileResolver): void {
    this.profileResolver = resolver;
  }

  registerBatchProfileResolver(resolver: BatchProfileResolver): void {
    this.batchProfileResolver = resolver;
  }

  async resolveProfile(
    account: Account,
    manager?: EntityManager,
  ): Promise<unknown> {
    if (this.profileResolver) {
      return this.profileResolver(account, manager);
    }
    if (account.role === 'Admin') {
      return this.adminProfile(account.user_id, manager);
    }
    return null;
  }

  async resolveProfiles(
    accounts: Account[],
    manager?: EntityManager,
  ): Promise<Map<string, unknown>> {
    if (!accounts.length) return new Map();
    if (this.batchProfileResolver) {
      return this.batchProfileResolver(accounts, manager);
    }
    const entries = await Promise.all(
      accounts.map(
        async (account) =>
          [
            account.user_id,
            await this.resolveProfile(account, manager),
          ] as const,
      ),
    );
    return new Map(entries);
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

  async activeVerifiedIdsByRole(role: Role): Promise<string[]> {
    const users = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .select(['u.user_id'])
      .where(
        'u.role = :role AND u.is_active = true AND u.email_verified_at IS NOT NULL',
        { role },
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
    includePassword = false,
  ): Promise<Account | null> {
    const query = manager
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.user_id = :id', { id });
    if (includePassword) query.addSelect('u.password_hash');
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

  async byIds(
    ids: string[],
    manager = this.dataSource.manager,
  ): Promise<Map<string, Account>> {
    if (!ids.length) return new Map();
    const accounts = await manager
      .getRepository(User)
      .findBy({ user_id: In([...new Set(ids)]) });
    return new Map(accounts.map((account) => [account.user_id, account]));
  }

  async adminProfile(id: string, manager = this.dataSource.manager) {
    return manager.getRepository(AdminProfile).findOneBy({ user_id: id });
  }

  async adminProfilesByIds(
    ids: string[],
    manager = this.dataSource.manager,
  ): Promise<Map<string, AdminProfile>> {
    if (!ids.length) return new Map();
    const rows = await manager
      .getRepository(AdminProfile)
      .findBy({ user_id: In([...new Set(ids)]) });
    return new Map(rows.map((row) => [row.user_id, row]));
  }

  async analyticsSummary(
    since: Date | null,
    prevSince: Date | null,
  ): Promise<{
    totals: {
      total_users: number;
      customers: number;
      restaurants: number;
      delivery_companies: number;
      unverified_companies: number;
    };
    period: { new_customers: number; new_restaurants: number };
    previous: { new_customers: number; new_restaurants: number } | null;
  }> {
    const qb = this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .select('COUNT(*)::int', 'total_users')
      .addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Customer')::int",
        'customers',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Restaurant')::int",
        'restaurants',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Delivery_Company')::int",
        'delivery_companies',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Delivery_Company' AND u.email_verified_at IS NULL)::int",
        'unverified_companies',
      );

    if (since) {
      qb.addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Customer' AND u.created_at >= :since)::int",
        'new_customers',
      )
        .addSelect(
          "COUNT(*) FILTER (WHERE u.role = 'Restaurant' AND u.created_at >= :since)::int",
          'new_restaurants',
        )
        .setParameter('since', since);
    } else {
      qb.addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Customer')::int",
        'new_customers',
      ).addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Restaurant')::int",
        'new_restaurants',
      );
    }

    if (since && prevSince) {
      qb.addSelect(
        "COUNT(*) FILTER (WHERE u.role = 'Customer' AND u.created_at >= :prevSince AND u.created_at < :since)::int",
        'prev_customers',
      )
        .addSelect(
          "COUNT(*) FILTER (WHERE u.role = 'Restaurant' AND u.created_at >= :prevSince AND u.created_at < :since)::int",
          'prev_restaurants',
        )
        .setParameter('prevSince', prevSince);
    }

    const row = await qb.getRawOne<{
      total_users: number;
      customers: number;
      restaurants: number;
      delivery_companies: number;
      unverified_companies: number;
      new_customers: number;
      new_restaurants: number;
      prev_customers?: number;
      prev_restaurants?: number;
    }>();

    return {
      totals: {
        total_users: Number(row?.total_users ?? 0),
        customers: Number(row?.customers ?? 0),
        restaurants: Number(row?.restaurants ?? 0),
        delivery_companies: Number(row?.delivery_companies ?? 0),
        unverified_companies: Number(row?.unverified_companies ?? 0),
      },
      period: {
        new_customers: Number(row?.new_customers ?? 0),
        new_restaurants: Number(row?.new_restaurants ?? 0),
      },
      previous:
        since && prevSince
          ? {
              new_customers: Number(row?.prev_customers ?? 0),
              new_restaurants: Number(row?.prev_restaurants ?? 0),
            }
          : null,
    };
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
    const take = filters.take ?? 20;
    const skip = filters.skip ?? 0;
    const [accounts, total] = await qb.skip(skip).take(take).getManyAndCount();

    const profiles = await this.resolveProfiles(accounts, manager);
    const items = accounts.map((account) =>
      this.safeUser(account, profiles.get(account.user_id) ?? null),
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
