import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  @RequirePermission('dashboard.read')
  stats(@CurrentUser() user: AuthUser) {
    return this.dashboard.adminStats(user);
  }

  @Get('kpis')
  @RequirePermission('dashboard.read')
  kpis(@CurrentUser() user: AuthUser) {
    return this.dashboard.kpis(user);
  }
}
