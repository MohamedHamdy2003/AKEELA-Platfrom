import { DeliveryController } from './delivery.controller';
import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { UsersModule } from '../users/users.module';
@Module({
  imports: [UsersModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
