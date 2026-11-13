import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiError, reply } from '../../common/http/api-error';
import {
  AuthActor,
  CurrentActor,
} from '../../common/http/current-actor.decorator';
import { DeliveryService } from './delivery.service';
import {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateCompanyDto,
  ListDriversQuery,
  serializeCompany,
  serializeDriver,
} from './delivery.dto';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
@Controller('delivery-company')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}
  private company(actor: AuthActor): string {
    if (actor.role !== 'Delivery_Company')
      throw new ApiError(403, 'FORBIDDEN', 'Delivery company access required.');
    return actor.userId;
  }
  @Get('profile') async profile(@CurrentActor() actor: AuthActor) {
    return reply(
      serializeCompany(await this.delivery.ownedProfile(this.company(actor))),
    );
  }
  @Patch('profile') async updateProfile(
    @CurrentActor() actor: AuthActor,
    @Body() body: UpdateCompanyDto,
  ) {
    return reply(
      serializeCompany(
        await this.delivery.updateProfile(this.company(actor), body),
      ),
      'Company profile updated.',
    );
  }
  @Get('drivers') async drivers(
    @CurrentActor() actor: AuthActor,
    @Query() query: ListDriversQuery,
  ) {
    const page = resolvePagination(query);
    const result = await this.delivery.listDrivers(this.company(actor), {
      ...page,
      is_active: query.is_active,
    });
    return {
      ...reply(result.items.map(serializeDriver)),
      meta: paginationMeta(result.total, page.page, page.per_page),
    };
  }
  @Post('drivers') async createDriver(
    @CurrentActor() actor: AuthActor,
    @Body() body: CreateDriverDto,
  ) {
    return reply(
      serializeDriver(
        await this.delivery.createDriver(this.company(actor), body),
      ),
      'Driver added.',
    );
  }
  @Patch('drivers/:driver_id') async updateDriver(
    @CurrentActor() actor: AuthActor,
    @Param('driver_id') driverId: string,
    @Body() body: UpdateDriverDto,
  ) {
    return reply(
      serializeDriver(
        await this.delivery.updateDriver(this.company(actor), driverId, body),
      ),
      'Driver updated.',
    );
  }
}
