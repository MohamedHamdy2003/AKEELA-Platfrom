import { Module } from '@nestjs/common';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { CatalogService } from './catalog.service';
import { RestaurantCategoriesController } from './restaurant-categories.controller';
import { RestaurantProductsController } from './restaurant-products.controller';

@Module({
  imports: [RestaurantsModule],
  controllers: [RestaurantCategoriesController, RestaurantProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
