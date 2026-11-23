import { AuthModule } from '../auth/auth.module';
import { OrderEventsGateway } from './order-events.gateway';
import { OrdersAutoDeliverService } from './orders-auto-deliver.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminRestaurantAnalyticsController } from './admin-restaurant-analytics.controller';
import { DeliveryAnalyticsService } from './delivery-analytics.service';
import { DeliveryAnalyticsController } from './delivery-analytics.controller';
import { RestaurantAnalyticsService } from './restaurant-analytics.service';
import { RestaurantAnalyticsController } from './restaurant-analytics.controller';
import { CatalogModule } from '../catalog/catalog.module';
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
    CatalogModule,
    UsersModule,
    RestaurantsModule,
    DeliveryModule,
  ],
  providers: [
    OrdersService,
    OrderEventsGateway,
    OrdersAutoDeliverService,
    AdminAnalyticsService,
    DeliveryAnalyticsService,
    RestaurantAnalyticsService,
  ],
  controllers: [
    CustomerOrdersController,
    RestaurantOrdersController,
    RestaurantAnalyticsController,
    AdminOrdersController,
    AdminAnalyticsController,
    AdminRestaurantAnalyticsController,
    DeliveryOrdersController,
    DeliveryAnalyticsController,
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
