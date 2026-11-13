import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { OrdersService } from './orders.service';
import { CustomerOrdersController } from './customer-orders.controller';
@Module({
  imports: [CartModule],
  providers: [OrdersService],
  controllers: [CustomerOrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
