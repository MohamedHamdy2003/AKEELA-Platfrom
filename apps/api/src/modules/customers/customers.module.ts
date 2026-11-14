import { Module } from '@nestjs/common';
import { CustomerAddressesController } from './customer-addresses.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomerAddressesController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
