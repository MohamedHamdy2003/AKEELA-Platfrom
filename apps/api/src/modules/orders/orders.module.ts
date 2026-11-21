import { AuthModule } from '../auth/auth.module';
import { OrderEventsGateway } from './order-events.gateway';
import { OrdersAutoDeliverService } from './orders-auto-deliver.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
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
  imports: [
    AuthModule,
    CartModule,
    UsersModule,
    RestaurantsModule,
    DeliveryModule,
  ],
  providers: [
    OrdersService,
    OrderEventsGateway,
    OrdersAutoDeliverService,
    AdminAnalyticsService,
  ],
  controllers: [
    CustomerOrdersController,
    RestaurantOrdersController,
    AdminOrdersController,
    AdminAnalyticsController,
    DeliveryOrdersController,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
