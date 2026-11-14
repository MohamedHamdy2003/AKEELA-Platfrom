import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CustomersModule } from '../customers/customers.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';
@Module({
  imports: [UsersModule, CustomersModule, RestaurantsModule, CatalogModule],
  providers: [ImagesService],
  controllers: [ImagesController],
})
export class ImagesModule {}
