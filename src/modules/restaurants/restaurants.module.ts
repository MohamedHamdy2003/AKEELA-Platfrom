import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { RestaurantsService } from './restaurants.service';
import { AdminRestaurantsController } from './admin-restaurants.controller';

@Module({
  imports: [UsersModule],
  controllers: [AdminRestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
