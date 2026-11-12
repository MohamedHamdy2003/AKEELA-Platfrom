import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DeliveryCompanyProfile } from './entities/delivery-company-profile.entity';
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
}
