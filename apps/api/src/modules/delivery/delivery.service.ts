import { ApiError } from '../../common/http/api-error';
import { DeliveryDriver } from './entities/delivery-driver.entity';
import {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateCompanyDto,
} from './delivery.dto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { DeliveryCompanyProfile } from './entities/delivery-company-profile.entity';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { Environment } from '../../config/environment';

export interface DeliveryCompanyRegistration {
  company_name: string;
  company_phone: string;
  company_email?: string | null;
  company_address: string;
  is_active?: boolean;
}

@Injectable()
export class DeliveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async defaultCompany(manager: EntityManager): Promise<string> {
    const id = this.config.get('DEFAULT_DELIVERY_COMPANY_ID', { infer: true });
    const company = id
      ? await manager
          .getRepository(DeliveryCompanyProfile)
          .createQueryBuilder('c')
          .innerJoin(
            'users',
            'u',
            'u.user_id = c.user_id AND u.is_active = true AND u.email_verified_at IS NOT NULL',
          )
          .where('c.company_id = :id AND c.is_active = true', { id })
          .getOne()
      : null;
    if (!company)
      throw new ApiError(
        409,
        'DELIVERY_COMPANY_UNAVAILABLE',
        'No active verified delivery company is configured. The order is still Pending.',
      );
    return company.company_id;
  }

  async driverForOrder(
    companyId: string,
    driverId: string,
    manager: EntityManager,
  ) {
    const driver = await manager
      .getRepository(DeliveryDriver)
      .findOneBy({ company_id: companyId, driver_id: driverId });
    if (!driver) throw new ApiError(404, 'NOT_FOUND', 'Driver not found.');
    if (!driver.is_active)
      throw new ApiError(409, 'DRIVER_UNAVAILABLE', 'Choose an active driver.');
    return driver.driver_id;
  }

  async profileById(
    companyId: string,
    manager = this.dataSource.manager,
  ): Promise<DeliveryCompanyProfile | null> {
    return manager
      .getRepository(DeliveryCompanyProfile)
      .findOneBy({ company_id: companyId });
  }

  async ownedProfile(userId: string, manager = this.dataSource.manager) {
    const company = await this.profile(userId, manager);
    if (!company)
      throw new ApiError(404, 'NOT_FOUND', 'Company profile not found.');
    return company;
  }
  async updateProfile(userId: string, input: UpdateCompanyDto) {
    if (input.is_active === false)
      throw new ApiError(
        409,
        'CONFLICT',
        'Delivery company service cannot be disabled in the single-company version.',
      );
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DeliveryCompanyProfile);
      const profile = await repo
        .createQueryBuilder('c')
        .where('c.user_id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!profile)
        throw new ApiError(404, 'NOT_FOUND', 'Company profile not found.');
      if (input.company_name !== undefined)
        profile.company_name = input.company_name;
      if (input.company_phone !== undefined)
        profile.company_phone = input.company_phone;
      if (input.company_email !== undefined)
        profile.company_email = input.company_email;
      if (input.company_address !== undefined)
        profile.company_address = input.company_address;
      if (input.is_active !== undefined) profile.is_active = input.is_active;
      return repo.save(profile);
    });
  }
  async listDrivers(
    userId: string,
    query: { skip: number; take: number; is_active?: 'true' | 'false' },
  ) {
    const company = await this.ownedProfile(userId);
    const [items, total] = await this.dataSource
      .getRepository(DeliveryDriver)
      .findAndCount({
        where: {
          company_id: company.company_id,
          ...(query.is_active === undefined
            ? {}
            : { is_active: query.is_active === 'true' }),
        },
        order: { driver_id: 'DESC' },
        skip: query.skip,
        take: query.take,
      });
    return { items, total };
  }
  async createDriver(userId: string, input: CreateDriverDto) {
    const company = await this.ownedProfile(userId);
    const repo = this.dataSource.getRepository(DeliveryDriver);
    return repo.save(
      repo.create({
        ...input,
        company_id: company.company_id,
        driver_email: input.driver_email ?? null,
        is_active: input.is_active ?? true,
      }),
    );
  }
  async updateDriver(userId: string, driverId: string, input: UpdateDriverDto) {
    const company = await this.ownedProfile(userId);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DeliveryDriver);
      const driver = await repo
        .createQueryBuilder('d')
        .where('d.driver_id = :driverId AND d.company_id = :companyId', {
          driverId,
          companyId: company.company_id,
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!driver) throw new ApiError(404, 'NOT_FOUND', 'Driver not found.');
      if (input.driver_name !== undefined)
        driver.driver_name = input.driver_name;
      if (input.driver_phone !== undefined)
        driver.driver_phone = input.driver_phone;
      if (input.driver_email !== undefined)
        driver.driver_email = input.driver_email;
      if (input.is_active !== undefined) driver.is_active = input.is_active;
      return repo.save(driver);
    });
  }
  async profile(
    userId: string,
    manager: EntityManager = this.dataSource.manager,
  ) {
    return manager
      .getRepository(DeliveryCompanyProfile)
      .findOneBy({ user_id: userId });
  }

  async profilesByUserIds(
    userIds: string[],
    manager: EntityManager = this.dataSource.manager,
  ): Promise<Map<string, DeliveryCompanyProfile>> {
    if (!userIds.length) return new Map();
    const rows = await manager
      .getRepository(DeliveryCompanyProfile)
      .findBy({ user_id: In([...new Set(userIds)]) });
    return new Map(rows.map((row) => [row.user_id, row]));
  }

  async driverCounts(): Promise<{ active: number; inactive: number }> {
    const rows = await this.dataSource
      .getRepository(DeliveryDriver)
      .createQueryBuilder('d')
      .select('d.is_active', 'is_active')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('d.is_active')
      .getRawMany<{ is_active: boolean; count: number }>();
    let active = 0;
    let inactive = 0;
    for (const row of rows) {
      if (row.is_active) active = Number(row.count);
      else inactive = Number(row.count);
    }
    return { active, inactive };
  }

  async companyDrivers(companyId: string): Promise<
    Array<{
      driver_id: string;
      driver_name: string;
      driver_phone: string;
      is_active: boolean;
    }>
  > {
    return this.dataSource.getRepository(DeliveryDriver).find({
      select: {
        driver_id: true,
        driver_name: true,
        driver_phone: true,
        is_active: true,
      },
      where: { company_id: companyId },
      order: { driver_id: 'ASC' },
    });
  }

  async create(
    userId: string,
    input: DeliveryCompanyRegistration,
    manager: EntityManager,
  ): Promise<DeliveryCompanyProfile> {
    if (input.is_active === false)
      throw new ApiError(
        409,
        'CONFLICT',
        'Delivery company service must be active in the single-company version.',
      );
    return manager.getRepository(DeliveryCompanyProfile).save(
      manager.getRepository(DeliveryCompanyProfile).create({
        ...input,
        user_id: userId,
        is_active: input.is_active ?? true,
      }),
    );
  }
}
