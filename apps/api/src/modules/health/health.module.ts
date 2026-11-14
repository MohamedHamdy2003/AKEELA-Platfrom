import { Controller, Get, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PublicRoute } from '../../common/http/public-route.decorator';
import { ApiError, reply } from '../../common/http/api-error';
@Controller('health')
@PublicRoute()
export class HealthController {
  constructor(private readonly db: DataSource) {}
  @Get('live') live() {
    return reply({ status: 'ok', checked_at: new Date() });
  }
  @Get('ready') async ready() {
    try {
      await this.db.query('SELECT 1');
    } catch {
      throw new ApiError(503, 'NOT_READY', 'Database is unavailable.');
    }
    return reply({ status: 'ok', checked_at: new Date() });
  }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
