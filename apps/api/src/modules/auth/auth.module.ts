import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { CustomersModule } from '../customers/customers.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { AuthService } from './auth.service';
import { AuthCryptoService } from './auth-crypto.service';
import { AuthCleanupService } from './auth-cleanup.service';
import { OtpMailService } from './otp-mail.service';
import { AccessGuard } from './access.guard';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { AuthController, MeController } from './auth.controller';
import { AdminUsersAuthController } from './admin-users-auth.controller';

@Module({
  imports: [
    UsersModule,
    CustomersModule,
    RestaurantsModule,
    DeliveryModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController, MeController, AdminUsersAuthController],
  providers: [
    AuthService,
    AuthCryptoService,
    AuthCleanupService,
    OtpMailService,
    AccessGuard,
    { provide: APP_GUARD, useExisting: AccessGuard },
    AuthRateLimitGuard,
  ],
  exports: [AuthService, AuthCryptoService],
})
export class AuthModule implements OnModuleInit {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  onModuleInit(): void {
    this.users.registerProfileResolver((account, manager) =>
      this.auth.getProfileFor(account, manager),
    );
    this.users.registerBatchProfileResolver((accounts, manager) =>
      this.auth.getProfilesFor(accounts, manager),
    );
  }
}
