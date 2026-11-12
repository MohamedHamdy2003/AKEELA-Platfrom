import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import { PublicRoute } from '../../common/http/public-route.decorator';
import {
  CurrentActor,
  AuthActor,
} from '../../common/http/current-actor.decorator';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import {
  ChangePasswordDto,
  EmailDto,
  LoginDto,
  OtpDto,
  PatchMeDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  RestaurantRegisterDto,
} from './auth.dto';

@Controller('auth')
@PublicRoute()
@UseGuards(AuthRateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register')
  async register(@Body() input: RegisterDto) {
    const result = await this.auth.register(input);
    return reply(
      result.user,
      result.delivered
        ? 'Account created. Check your email for the verification code.'
        : 'Account created. Email delivery failed; request a new verification code after the cooldown.',
    );
  }
  @Post('register/restaurant')
  async registerRestaurant(@Body() input: RestaurantRegisterDto) {
    const result = await this.auth.register(input, input.profile);
    return reply(
      result.user,
      result.delivered
        ? 'Restaurant account created and awaiting activation. Check your email.'
        : 'Restaurant account created and awaiting activation. Email delivery failed; request a new verification code after the cooldown.',
    );
  }
  @Post('verify-email')
  @HttpCode(200)
  async verify(@Body() input: OtpDto) {
    await this.auth.verifyEmail(input.email, input.otp);
    return reply(null, 'Email verified. You can log in.');
  }
  @Post('resend-verification')
  @HttpCode(200)
  async resend(@Body() input: EmailDto) {
    await this.auth.requestCode(input.email, 'Email_Verification');
    return reply(null, 'If this account is eligible, an email has been sent.');
  }
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Body() input: EmailDto) {
    await this.auth.requestCode(input.email, 'Password_Reset');
    return reply(null, 'If this account is eligible, an email has been sent.');
  }
  @Post('reset-password')
  @HttpCode(200)
  async reset(@Body() input: ResetPasswordDto) {
    await this.auth.resetPassword(input);
    return reply(null, 'Password reset. Log in again.');
  }
  @Post('login')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async login(@Body() input: LoginDto) {
    return reply(
      await this.auth.login(input.email, input.password),
      'Login successful.',
    );
  }
  @Post('refresh')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async refresh(@Body() input: RefreshDto) {
    return reply(
      await this.auth.refresh(input.refresh_token),
      'Tokens refreshed.',
    );
  }
  @Post('logout')
  @HttpCode(200)
  @PublicRoute(false)
  async logout(@CurrentActor() actor: AuthActor) {
    await this.auth.logout(actor);
    return reply(null, 'Logged out.');
  }
}

@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}
  @Get()
  @Header('Cache-Control', 'no-store')
  async me(@CurrentActor() actor: AuthActor) {
    return reply(await this.auth.me(actor));
  }
  @Patch()
  @Header('Cache-Control', 'no-store')
  async patch(@CurrentActor() actor: AuthActor, @Body() input: PatchMeDto) {
    return reply(await this.auth.patchMe(actor, input), 'Profile updated.');
  }
  @Patch('password')
  @UseGuards(AuthRateLimitGuard)
  async password(
    @CurrentActor() actor: AuthActor,
    @Body() input: ChangePasswordDto,
  ) {
    await this.auth.changePassword(actor, input);
    return reply(null, 'Password changed. Log in again.');
  }
}
