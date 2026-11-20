import { ImagesModule } from './modules/images/images.module';
import { HealthModule } from './modules/health/health.module';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { ApiRateLimitGuard } from './common/http/api-rate-limit.guard';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    RestaurantsModule,
    CatalogModule,
    DeliveryModule,
    CartModule,
    OrdersModule,
    ImagesModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ApiRateLimitGuard }],
})
export class AppModule {}
