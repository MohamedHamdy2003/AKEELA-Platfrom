import { Module } from '@nestjs/common';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { CatalogService } from './catalog.service';
import { OfferExpirationScheduler } from './offer-expiration.scheduler';
import { RestaurantCategoriesController } from './restaurant-categories.controller';
import { RestaurantProductsController } from './restaurant-products.controller';
import { RestaurantAddonsController } from './restaurant-addons.controller';
import { RestaurantOffersController } from './restaurant-offers.controller';
import { PublicMenuController } from './public-menu.controller';
import { PublicOffersController } from './public-offers.controller';
import { PublicSearchController } from './public-search.controller';
import { OffersFeedService } from './offers-feed.service';
import { CatalogSearchService } from './search.service';

@Module({
  imports: [RestaurantsModule],
  controllers: [
    RestaurantCategoriesController,
    RestaurantProductsController,
    RestaurantAddonsController,
    RestaurantOffersController,
    PublicMenuController,
    PublicOffersController,
    PublicSearchController,
  ],
  providers: [
    CatalogService,
    CatalogSearchService,
    OffersFeedService,
    OfferExpirationScheduler,
  ],
  exports: [CatalogService, CatalogSearchService, OffersFeedService],
})
export class CatalogModule {}
