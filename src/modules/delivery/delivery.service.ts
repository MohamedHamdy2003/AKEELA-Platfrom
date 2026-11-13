import { ApiError } from '../../common/http/api-error';
import { DeliveryDriver } from './entities/delivery-driver.entity';
import {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateCompanyDto,
} from './delivery.dto';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DeliveryCompanyProfile } from './entities/delivery-company-profile.entity';

export interface DeliveryCompanyRegistration {
  company_name: string;
  company_phone: string;
  company_email?: string | null;
  company_address: string;
  is_active?: boolean;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly dataSource: DataSource) {}

  async ownedProfile(userId: string, manager = this.dataSource.manager) {
    const company = await this.profile(userId, manager);
    if (!company)
      throw new ApiError(404, 'NOT_FOUND', 'Company profile not found.');
    return company;
  }
  async updateProfile(userId: string, input: UpdateCompanyDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(DeliveryCompanyProfile);
      const profile = await repo
        .createQueryBuilder('c')
        .where('c.user_id = :userId', { userId })
        .setLock('pessimistic_write')
        .getOne();
      if (!profile)
        throw new ApiError(404, 'NOT_FOUND', 'Company profile not found.');
      Object.assign(profile, input);
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
      Object.assign(driver, input);
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

  async create(
    userId: string,
    input: DeliveryCompanyRegistration,
    manager: EntityManager,
  ): Promise<DeliveryCompanyProfile> {
    return manager.getRepository(DeliveryCompanyProfile).save(
      manager.getRepository(DeliveryCompanyProfile).create({
        ...input,
        user_id: userId,
        is_active: input.is_active ?? true,
      }),
    );
  }
}
