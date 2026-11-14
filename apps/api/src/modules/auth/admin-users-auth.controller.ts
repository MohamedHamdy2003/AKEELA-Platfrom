import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  CurrentActor,
  AuthActor,
} from '../../common/http/current-actor.decorator';
import { AdminCreateUserDto } from '../users/admin.dto';
import { AuthService } from './auth.service';

@Controller('admin/users')
export class AdminUsersAuthController {
  constructor(private readonly auth: AuthService) {}

  private assertAdmin(actor: AuthActor): void {
    if (actor.role !== 'Admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
    }
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentActor() actor: AuthActor,
    @Body() input: AdminCreateUserDto,
  ) {
    this.assertAdmin(actor);
    const user = await this.auth.createAccountByAdmin(input);
    return reply(user, 'Account created.');
  }
}
