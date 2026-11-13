import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  CurrentActor,
  AuthActor,
} from '../../common/http/current-actor.decorator';
import { CustomersService } from './customers.service';
import {
  CreateAddressDto,
  ListAddressesQuery,
  UpdateAddressDto,
} from './customers.dto';
import { paginationMeta, resolvePagination } from '../users/admin.dto';

@Controller('customer/addresses')
export class CustomerAddressesController {
  constructor(private readonly customers: CustomersService) {}

  private assertCustomer(actor: AuthActor): void {
    if (actor.role !== 'Customer') {
      throw new ApiError(403, 'FORBIDDEN', 'Customer access required.');
    }
  }

  @Get()
  async list(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListAddressesQuery,
  ) {
    this.assertCustomer(actor);
    const pagination = resolvePagination(query);
    const { items, total } = await this.customers.listAddresses(actor.userId, {
      skip: pagination.skip,
      take: pagination.take,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items,
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Post()
  async create(
    @CurrentActor() actor: AuthActor,
    @Body() body: CreateAddressDto,
  ) {
    this.assertCustomer(actor);
    const address = await this.customers.createAddress(actor.userId, body);
    return reply(address, 'Address saved.');
  }

  @Patch(':address_id')
  async update(
    @CurrentActor() actor: AuthActor,
    @Param('address_id') addressId: string,
    @Body() body: UpdateAddressDto,
  ) {
    this.assertCustomer(actor);
    const address = await this.customers.updateAddress(
      actor.userId,
      addressId,
      body,
    );
    return reply(address, 'Address updated.');
  }

  @Put(':address_id/default')
  async setDefault(
    @CurrentActor() actor: AuthActor,
    @Param('address_id') addressId: string,
  ) {
    this.assertCustomer(actor);
    const address = await this.customers.setDefaultAddress(
      actor.userId,
      addressId,
    );
    return reply(address, 'Default address updated.');
  }

  @Delete(':address_id')
  @HttpCode(200)
  async delete(
    @CurrentActor() actor: AuthActor,
    @Param('address_id') addressId: string,
  ) {
    this.assertCustomer(actor);
    await this.customers.deleteAddress(actor.userId, addressId);
    return reply(null, 'Address deleted.');
  }
}
