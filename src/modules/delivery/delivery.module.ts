import { DeliveryController } from './delivery.controller';
import { Module } from '@nestjs/common';
import { DeliveryService } from './delivery.service';
@Module({
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
