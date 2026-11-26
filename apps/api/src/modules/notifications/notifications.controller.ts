import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { RegisterDeviceTokenDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('me/device-tokens')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@CurrentActor() actor: AuthActor) {
    return reply(await this.notifications.listOwnTokens(actor));
  }

  @Put()
  @HttpCode(200)
  async register(
    @CurrentActor() actor: AuthActor,
    @Body() input: RegisterDeviceTokenDto,
  ) {
    return reply(
      await this.notifications.registerToken(actor, input),
      'Device token registered.',
    );
  }

  @Delete(':token_id')
  @HttpCode(200)
  async remove(
    @CurrentActor() actor: AuthActor,
    @Param('token_id') tokenId: string,
  ) {
    await this.notifications.unregisterToken(actor, tokenId);
    return reply(null, 'Device token removed.');
  }
}
