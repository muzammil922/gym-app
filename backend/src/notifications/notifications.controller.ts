import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  @RequirePermission('dashboard.read')
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const size = Number(pageSize || limit) || 20;
    return this.notifications.list(user, Number(page) || 1, size);
  }

  @Post('read-all')
  @RequirePermission('dashboard.read')
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user);
  }

  @Post(':id/read')
  @RequirePermission('dashboard.read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }
}
