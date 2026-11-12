import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators/roles.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      ok: true,
      timezone: process.env.TZ || 'Asia/Karachi',
      currency: process.env.DEFAULT_CURRENCY || 'PKR',
      utc: new Date().toISOString(),
    };
  }
}
