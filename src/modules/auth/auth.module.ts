import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { CustomersModule } from '../customers/customers.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { AuthService } from './auth.service';
import { AuthCryptoService } from './auth-crypto.service';
import { OtpMailService } from './otp-mail.service';
import { AccessGuard } from './access.guard';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthController, MeController } from './auth.controller';
@Module({
  imports: [
    UsersModule,
    CustomersModule,
    RestaurantsModule,
    DeliveryModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    AuthCryptoService,
    OtpMailService,
    AccessGuard,
    { provide: APP_GUARD, useExisting: AccessGuard },
    AuthRateLimitGuard,
  ],
})
export class AuthModule {}
