import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { CatalogModule } from '../catalog/catalog.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
@Module({
  imports: [CustomersModule, CatalogModule, RestaurantsModule],
  providers: [CartService],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
