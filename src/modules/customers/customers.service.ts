import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CustomerProfile } from './entities/customer-profile.entity';
@Injectable()
export class CustomersService {
  constructor(private readonly dataSource: DataSource) {}
  async create(userId: string, manager: EntityManager) {
    return manager
      .getRepository(CustomerProfile)
      .save(manager.getRepository(CustomerProfile).create({ user_id: userId }));
  }
  async profile(userId: string, manager = this.dataSource.manager) {
    return manager
      .getRepository(CustomerProfile)
      .findOneBy({ user_id: userId });
  }
  async setAvatar(
    userId: string,
    url: string | null,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(CustomerProfile)
      .update({ user_id: userId }, { cus_avatar_url: url });
  }
}
