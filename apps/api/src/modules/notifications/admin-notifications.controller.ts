import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { AdminSendNotificationDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('send')
  @HttpCode(200)
  async send(
    @CurrentActor() actor: AuthActor,
    @Body() input: AdminSendNotificationDto,
  ) {
    return reply(
      await this.notifications.adminSend(actor, input),
      'Notification dispatch completed.',
    );
  }
}
