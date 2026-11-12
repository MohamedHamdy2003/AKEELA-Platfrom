import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from './entities/user.entity';
import { AdminProfile } from './entities/admin-profile.entity';
import { Account, NewAccount } from './account.types';
@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}
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
        'full_name' | 'phone_number' | 'password_hash' | 'email_verified_at'
      >
    >,
    manager: EntityManager,
  ): Promise<void> {
    await manager.getRepository(User).update({ user_id: id }, fields);
  }
  async adminProfile(id: string, manager = this.dataSource.manager) {
    return manager.getRepository(AdminProfile).findOneBy({ user_id: id });
  }
}
