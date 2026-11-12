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
