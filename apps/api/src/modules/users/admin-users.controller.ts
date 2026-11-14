import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  CurrentActor,
  AuthActor,
} from '../../common/http/current-actor.decorator';
import { UsersService } from './users.service';
import {
  ListUsersQuery,
  SetActivityDto,
  paginationMeta,
  resolvePagination,
} from './admin.dto';

@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  private assertAdmin(actor: AuthActor): void {
    if (actor.role !== 'Admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
    }
  }

  @Get()
  async list(@CurrentActor() actor: AuthActor, @Query() query: ListUsersQuery) {
    this.assertAdmin(actor);
    const pagination = resolvePagination(query);
    const { items, total } = await this.users.listUsers({
      role: query.role,
      is_active:
        query.is_active !== undefined ? query.is_active === 'true' : undefined,
      page: pagination.page,
      per_page: pagination.per_page,
    });
    return {
      success: true,
      message: 'Records returned.',
      data: items,
      meta: paginationMeta(total, pagination.page, pagination.per_page),
    };
  }

  @Get(':user_id')
  async getOne(
    @CurrentActor() actor: AuthActor,
    @Param('user_id') userId: string,
  ) {
    this.assertAdmin(actor);
    return reply(await this.users.getUser(userId));
  }

  @Patch(':user_id/activity')
  @HttpCode(200)
  async setActivity(
    @CurrentActor() actor: AuthActor,
    @Param('user_id') userId: string,
    @Body() input: SetActivityDto,
  ) {
    this.assertAdmin(actor);
    return reply(
      await this.users.setActivity(userId, input.is_active),
      'Account activity updated.',
    );
  }
}
