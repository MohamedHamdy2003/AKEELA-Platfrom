import { UsersModule } from '../users/users.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { RestaurantOrdersController } from './restaurant-orders.controller';
import { AdminOrdersController } from './admin-orders.controller';
import { DeliveryOrdersController } from './delivery-orders.controller';
import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { OrdersService } from './orders.service';
import { CustomerOrdersController } from './customer-orders.controller';
@Module({
  imports: [CartModule, UsersModule, RestaurantsModule, DeliveryModule],
  providers: [OrdersService],
  controllers: [
    CustomerOrdersController,
    RestaurantOrdersController,
    AdminOrdersController,
    DeliveryOrdersController,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
