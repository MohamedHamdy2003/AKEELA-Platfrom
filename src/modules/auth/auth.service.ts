import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, MoreThan, IsNull } from 'typeorm';
import { Environment } from '../../config/environment';
import { ApiError } from '../../common/http/api-error';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { UsersService } from '../users/users.service';
import { Account } from '../users/account.types';
import { CustomersService } from '../customers/customers.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DeliveryService } from '../delivery/delivery.service';
import {
  AuthChallenge,
  ChallengePurpose,
} from './entities/auth-challenge.entity';
import { AuthSession } from './entities/auth-session.entity';
import { AuthCryptoService } from './auth-crypto.service';
import { OtpMailService } from './otp-mail.service';
import {
  ChangePasswordDto,
  PatchMeDto,
  RegisterDto,
  RestaurantProfileDto,
  ResetPasswordDto,
} from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly customers: CustomersService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
    private readonly crypto: AuthCryptoService,
    private readonly mail: OtpMailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private unauthorized(): never {
    throw new ApiError(
      401,
      'UNAUTHENTICATED',
      'Invalid or expired credentials.',
    );
  }
  private checkAccount(account: Account): void {
    if (!account.is_active)
      throw new ApiError(403, 'FORBIDDEN', 'This account is inactive.');
    if (!account.email_verified_at)
      throw new ApiError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Verify your email before login.',
      );
  }
  async register(input: RegisterDto, restaurant?: RestaurantProfileDto) {
    if (restaurant && restaurant.opens_at === restaurant.closes_at) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Opening and closing times must differ.',
        { 'profile.closes_at': ['Must differ from opens_at.'] },
      );
    }
    const passwordHash = await this.crypto.hashPassword(input.password);
    const result = await this.db.transaction(async (manager) => {
      const account = await this.users.create(
        {
          full_name: input.full_name,
          email: input.email,
          phone_number: input.phone,
          password_hash: passwordHash,
          role: restaurant ? 'Restaurant' : 'Customer',
        },
        manager,
      );
      if (restaurant)
        await this.restaurants.create(account.user_id, restaurant, manager);
      else await this.customers.create(account.user_id, manager);
      const code = await this.issueCode(account, 'Email_Verification', manager);
      return { account, code };
    });
    const delivered = await this.mail.send(
      result.account.email,
      'Email_Verification',
      result.code!,
    );
    return { user: await this.userData(result.account), delivered };
  }

  // All challenge/session mutations lock the user first, then their own row.
  private async issueCode(
    account: Account,
    purpose: ChallengePurpose,
    manager: EntityManager,
  ): Promise<string | null> {
    const repo = manager.getRepository(AuthChallenge);
    const previous = await repo
      .createQueryBuilder('c')
      .addSelect('c.otp_hash')
      .where('c.user_id = :userId AND c.purpose = :purpose', {
        userId: account.user_id,
        purpose,
      })
      .setLock('pessimistic_write')
      .getOne();
    const now = new Date();
    if (previous && previous.next_send_at > now) return null;
    let code = this.crypto.newOtp();
    while (
      previous &&
      this.crypto.matchesOtp(account.user_id, purpose, code, previous.otp_hash)
    )
      code = this.crypto.newOtp();
    await repo.save(
      repo.create({
        user_id: account.user_id,
        purpose,
        otp_hash: this.crypto.otpHash(account.user_id, purpose, code),
        attempt_count: 0,
        consumed_at: null,
        created_at: now,
        updated_at: now,
        expires_at: new Date(
          now.getTime() +
            this.config.get('OTP_TTL_SECONDS', { infer: true }) * 1000,
        ),
        next_send_at: new Date(
          now.getTime() +
            this.config.get('OTP_RESEND_SECONDS', { infer: true }) * 1000,
        ),
      }),
    );
    return code;
  }

  async requestCode(email: string, purpose: ChallengePurpose): Promise<void> {
    const candidate = await this.users.byEmail(email);
    if (!candidate) return;
    const result = await this.db.transaction(async (manager) => {
      const account = await this.users.byId(candidate.user_id, manager, true);
      if (
        !account?.is_active ||
        (purpose === 'Email_Verification' && account.email_verified_at)
      )
        return null;
      const code = await this.issueCode(account, purpose, manager);
      return code ? { email: account.email, code } : null;
    });
    if (result) await this.mail.send(result.email, purpose, result.code);
  }

  private async consumeCode(
    account: Account,
    purpose: ChallengePurpose,
    code: string,
    manager: EntityManager,
  ): Promise<boolean> {
    const repo = manager.getRepository(AuthChallenge);
    const challenge = await repo
      .createQueryBuilder('c')
      .addSelect('c.otp_hash')
      .where('c.user_id = :userId AND c.purpose = :purpose', {
        userId: account.user_id,
        purpose,
      })
      .setLock('pessimistic_write')
      .getOne();
    if (
      !challenge ||
      challenge.consumed_at ||
      challenge.expires_at <= new Date() ||
      challenge.attempt_count >=
        this.config.get('OTP_MAX_ATTEMPTS', { infer: true })
    )
      return false;
    if (
      !this.crypto.matchesOtp(
        account.user_id,
        purpose,
        code,
        challenge.otp_hash,
      )
    ) {
      challenge.attempt_count += 1;
      await repo.save(challenge);
      return false; // Commit failed attempts; throw only after transaction returns.
    }
    challenge.consumed_at = new Date();
    await repo.save(challenge);
    return true;
  }

  private invalidOtp(): never {
    throw new ApiError(
      400,
      'OTP_INVALID_OR_EXPIRED',
      'The code is invalid, expired, used, or locked.',
    );
  }
  async verifyEmail(email: string, code: string): Promise<void> {
    const candidate = await this.users.byEmail(email);
    if (!candidate) this.invalidOtp();
    const success = await this.db.transaction(async (manager) => {
      const account = await this.users.byId(candidate.user_id, manager, true);
      if (!account?.is_active || account.email_verified_at) return false;
      if (
        !(await this.consumeCode(account, 'Email_Verification', code, manager))
      )
        return false;
      await this.users.update(
        account.user_id,
        { email_verified_at: new Date() },
        manager,
      );
      return true;
    });
    if (!success) this.invalidOtp();
  }

  async login(email: string, password: string) {
    const candidate = await this.users.byEmail(email);
    if (
      !(await this.crypto.verifyPassword(
        password,
        candidate?.password_hash ?? null,
      )) ||
      !candidate
    )
      this.unauthorized();
    this.checkAccount(candidate);
    const result = await this.db.transaction(async (manager) => {
      const account = await this.users.byId(candidate.user_id, manager, true);
      if (!account || account.password_hash !== candidate.password_hash)
        this.unauthorized();
      this.checkAccount(account);
      const refresh = this.crypto.newRefresh();
      const repo = manager.getRepository(AuthSession);
      const session = await repo.save(
        repo.create({
          session_id: randomUUID(),
          user_id: account.user_id,
          refresh_token_hash: this.crypto.tokenHash(refresh),
          revoked_at: null,
          expires_at: new Date(
            Date.now() +
              this.config.get('AUTH_REFRESH_TTL_SECONDS', { infer: true }) *
                1000,
          ),
        }),
      );
      return {
        account,
        tokens: await this.tokens(account.user_id, session, refresh),
      };
    });
    return { user: await this.userData(result.account), tokens: result.tokens };
  }

  private async tokens(userId: string, session: AuthSession, refresh: string) {
    const remaining = Math.max(
      1,
      Math.floor((session.expires_at.getTime() - Date.now()) / 1000),
    );
    const ttl = Math.min(
      this.config.get('JWT_ACCESS_TTL_SECONDS', { infer: true }),
      remaining,
    );
    const access = await this.jwt.signAsync(
      { sub: userId, sid: session.session_id },
      {
        algorithm: 'HS256',
        secret: this.config.get('JWT_SECRET', { infer: true }),
        expiresIn: ttl,
        issuer: this.config.get('JWT_ISSUER', { infer: true }),
        audience: this.config.get('JWT_AUDIENCE', { infer: true }),
      },
    );
    return {
      token_type: 'Bearer',
      access_token: access,
      expires_in: ttl,
      refresh_token: refresh,
      refresh_expires_in: remaining,
    };
  }

  async refresh(raw: string) {
    const hash = this.crypto.tokenHash(raw);
    const candidate = await this.db
      .getRepository(AuthSession)
      .findOneBy({ refresh_token_hash: hash });
    if (!candidate) this.unauthorized();
    return this.db.transaction(async (manager) => {
      const account = await this.users.byId(candidate.user_id, manager, true);
      if (!account) this.unauthorized();
      this.checkAccount(account);
      const repo = manager.getRepository(AuthSession);
      const session = await repo.findOne({
        where: { session_id: candidate.session_id, refresh_token_hash: hash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session || session.revoked_at || session.expires_at <= new Date())
        this.unauthorized();
      const refresh = this.crypto.newRefresh();
      session.refresh_token_hash = this.crypto.tokenHash(refresh);
      await repo.save(session);
      return this.tokens(account.user_id, session, refresh);
    });
  }

  async authenticate(token: string): Promise<AuthActor> {
    let payload: { sub?: unknown; sid?: unknown; exp?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, {
        algorithms: ['HS256'],
        secret: this.config.get('JWT_SECRET', { infer: true }),
        issuer: this.config.get('JWT_ISSUER', { infer: true }),
        audience: this.config.get('JWT_AUDIENCE', { infer: true }),
      });
    } catch {
      this.unauthorized();
    }
    if (
      typeof payload.sub !== 'string' ||
      !/^[1-9]\d{0,18}$/.test(payload.sub) ||
      BigInt(payload.sub) > 9223372036854775807n ||
      typeof payload.exp !== 'number' ||
      typeof payload.sid !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.sid,
      )
    )
      this.unauthorized();
    const session = await this.db.getRepository(AuthSession).findOneBy({
      session_id: payload.sid,
      user_id: payload.sub,
      revoked_at: IsNull(),
      expires_at: MoreThan(new Date()),
    });
    // Explicit revoked check below avoids using a nullable filter as an accidental wildcard.
    if (!session || session.revoked_at) this.unauthorized();
    const account = await this.users.byId(payload.sub);
    if (!account) this.unauthorized();
    this.checkAccount(account);
    return {
      userId: account.user_id,
      sessionId: session.session_id,
      role: account.role,
    };
  }

  private async revokeAll(
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(AuthSession)
      .update({ user_id: userId }, { revoked_at: new Date() });
  }
  async logout(actor: AuthActor): Promise<void> {
    await this.db.transaction(async (manager) => {
      await this.users.byId(actor.userId, manager, true);
      await manager
        .getRepository(AuthSession)
        .update(
          { session_id: actor.sessionId, user_id: actor.userId },
          { revoked_at: new Date() },
        );
    });
  }
  async resetPassword(input: ResetPasswordDto): Promise<void> {
    const candidate = await this.users.byEmail(input.email);
    if (!candidate) this.invalidOtp();
    const hash = await this.crypto.hashPassword(input.new_password);
    const success = await this.db.transaction(async (manager) => {
      const account = await this.users.byId(candidate.user_id, manager, true);
      if (
        !account?.is_active ||
        !(await this.consumeCode(account, 'Password_Reset', input.otp, manager))
      )
        return false;
      await this.users.update(
        account.user_id,
        { password_hash: hash },
        manager,
      );
      await this.revokeAll(account.user_id, manager);
      return true;
    });
    if (!success) this.invalidOtp();
  }
  async changePassword(
    actor: AuthActor,
    input: ChangePasswordDto,
  ): Promise<void> {
    const hash = await this.crypto.hashPassword(input.new_password);
    await this.db.transaction(async (manager) => {
      const account = await this.users.byId(actor.userId, manager, true);
      if (
        !account ||
        !(await this.crypto.verifyPassword(
          input.current_password,
          account.password_hash,
        ))
      )
        this.unauthorized();
      await this.assertLiveSession(actor, manager);
      this.checkAccount(account);
      await this.users.update(
        account.user_id,
        { password_hash: hash },
        manager,
      );
      await this.revokeAll(account.user_id, manager);
      await manager
        .getRepository(AuthChallenge)
        .update(
          { user_id: account.user_id, purpose: 'Password_Reset' },
          { consumed_at: new Date() },
        );
    });
  }
  private async assertLiveSession(
    actor: AuthActor,
    manager: EntityManager,
  ): Promise<void> {
    const session = await manager
      .getRepository(AuthSession)
      .findOneBy({ session_id: actor.sessionId, user_id: actor.userId });
    if (!session || session.revoked_at || session.expires_at <= new Date())
      this.unauthorized();
  }

  async me(actor: AuthActor) {
    const account = await this.users.byId(actor.userId);
    if (!account) this.unauthorized();
    this.checkAccount(account);
    return this.userData(account);
  }
  async patchMe(actor: AuthActor, input: PatchMeDto) {
    const account = await this.db.transaction(async (manager) => {
      const current = await this.users.byId(actor.userId, manager, true);
      if (!current) this.unauthorized();
      this.checkAccount(current);
      await this.assertLiveSession(actor, manager);
      if (current.role === 'Restaurant') {
        const profile = await this.restaurants.profile(
          current.user_id,
          manager,
        );
        if (profile?.activation_status !== 'Active')
          throw new ApiError(
            403,
            'RESTAURANT_NOT_ACTIVE',
            'Restaurant management is not active.',
          );
      }
      if (input.cus_avatar_url !== undefined && current.role !== 'Customer')
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Only customers have an avatar.',
          { cus_avatar_url: ['Not available for this role.'] },
        );
      if (input.full_name !== undefined || input.phone !== undefined)
        await this.users.update(
          current.user_id,
          {
            ...(input.full_name !== undefined
              ? { full_name: input.full_name }
              : {}),
            ...(input.phone !== undefined ? { phone_number: input.phone } : {}),
          },
          manager,
        );
      if (input.cus_avatar_url !== undefined)
        await this.customers.setAvatar(
          current.user_id,
          input.cus_avatar_url,
          manager,
        );
      return (await this.users.byId(current.user_id, manager))!;
    });
    return this.userData(account);
  }

  async createAccountByAdmin(input: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
    role: 'Delivery_Company' | 'Admin';
    profile?: {
      company_name: string;
      company_phone: string;
      company_email?: string | null;
      company_address: string;
      is_active?: boolean;
    };
  }) {
    if (input.role === 'Admin') {
      throw new ApiError(
        409,
        'CONFLICT',
        'An Admin account already exists. Only one Admin is permitted and must be created via CLI.',
      );
    }
    const email = input.email.trim().toLowerCase();
    const passwordHash = await this.crypto.hashPassword(input.password);
    const account = await this.db.transaction(async (manager) => {
      const created = await this.users.create(
        {
          full_name: input.full_name,
          email,
          phone_number: input.phone,
          password_hash: passwordHash,
          role: input.role,
        },
        manager,
      );
      if (input.role === 'Delivery_Company' && input.profile) {
        await this.delivery.create(created.user_id, input.profile, manager);
      }
      return created;
    });
    return this.userData(account);
  }

  async getProfileFor(account: Account) {
    return account.role === 'Customer'
      ? await this.customers.profile(account.user_id)
      : account.role === 'Restaurant'
        ? await this.restaurants.profile(account.user_id)
        : account.role === 'Delivery_Company'
          ? await this.delivery.profile(account.user_id)
          : await this.users.adminProfile(account.user_id);
  }

  async userData(account: Account) {
    const profile = await this.getProfileFor(account);
    return {
      user_id: account.user_id,
      full_name: account.full_name,
      email: account.email,
      phone: account.phone_number,
      role: account.role,
      is_active: account.is_active,
      email_verified_at: account.email_verified_at,
      profile,
      created_at: account.created_at,
      updated_at: account.updated_at,
    };
  }
}
