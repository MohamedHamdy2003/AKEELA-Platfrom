import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CustomerProfile } from './entities/customer-profile.entity';
import { CustomerAddress } from './entities/customer-address.entity';
import {
  CreateAddressDto,
  UpdateAddressDto,
  serializeAddress,
  AddressResponse,
} from './customers.dto';
import { ApiError } from '../../common/http/api-error';

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

  async listAddresses(
    userId: string,
    options: { skip: number; take: number },
  ): Promise<{ items: AddressResponse[]; total: number }> {
    const [addresses, total] = await this.dataSource
      .getRepository(CustomerAddress)
      .findAndCount({
        where: { user_id: userId },
        order: { is_default: 'DESC', address_id: 'DESC' },
        skip: options.skip,
        take: options.take,
      });

    return {
      items: addresses.map(serializeAddress),
      total,
    };
  }

  async createAddress(
    userId: string,
    dto: CreateAddressDto,
  ): Promise<AddressResponse> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);

      const count = await repo.countBy({ user_id: userId });
      if (count >= 2) {
        throw new ApiError(
          409,
          'CONFLICT',
          'Customers can save at most 2 addresses.',
        );
      }

      const isDefault = Boolean(dto.is_default);

      if (isDefault) {
        await repo.update(
          { user_id: userId, is_default: true },
          { is_default: false },
        );
      }

      const address = repo.create({
        user_id: userId,
        address_title: dto.address_title,
        address_line: dto.address_line,
        longitude: dto.longitude,
        latitude: dto.latitude,
        is_default: isDefault,
      });

      const saved = await repo.save(address);
      return serializeAddress(saved);
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<AddressResponse> {
    if (!/^\d+$/.test(addressId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);
      const address = await repo.findOneBy({
        address_id: addressId,
        user_id: userId,
      });

      if (!address) {
        throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
      }

      if (dto.is_default === true) {
        await repo.update(
          { user_id: userId, is_default: true },
          { is_default: false },
        );
        address.is_default = true;
      } else if (dto.is_default === false) {
        address.is_default = false;
      }

      if (dto.address_title !== undefined) {
        address.address_title = dto.address_title;
      }
      if (dto.address_line !== undefined) {
        address.address_line = dto.address_line;
      }
      if (dto.longitude !== undefined) {
        address.longitude = dto.longitude;
      }
      if (dto.latitude !== undefined) {
        address.latitude = dto.latitude;
      }

      const updated = await repo.save(address);
      return serializeAddress(updated);
    });
  }

  async setDefaultAddress(
    userId: string,
    addressId: string,
  ): Promise<AddressResponse> {
    if (!/^\d+$/.test(addressId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(CustomerAddress);
      const address = await repo.findOneBy({
        address_id: addressId,
        user_id: userId,
      });

      if (!address) {
        throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
      }

      await repo.update(
        { user_id: userId, is_default: true },
        { is_default: false },
      );
      address.is_default = true;
      const updated = await repo.save(address);
      return serializeAddress(updated);
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    if (!/^\d+$/.test(addressId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
    }

    const repo = this.dataSource.getRepository(CustomerAddress);
    const address = await repo.findOneBy({
      address_id: addressId,
      user_id: userId,
    });

    if (!address) {
      throw new ApiError(404, 'NOT_FOUND', 'Address not found.');
    }

    await repo.delete({ address_id: addressId, user_id: userId });
  }
}
