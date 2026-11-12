import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import {
  AttendanceQueryDto,
  CreateDeviceDto,
  ManualCheckInDto,
  UpdateDeviceDto,
  UpdateAttendanceLogDto,
} from './dto/attendance.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private attendance: AttendanceService) {}

  @Get('live')
  @RequirePermission('attendance.read')
  live(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.attendance.live(user, limit ? Number(limit) : 50);
  }

  @Get('history')
  @RequirePermission('attendance.read')
  history(@CurrentUser() user: AuthUser, @Query() query: AttendanceQueryDto) {
    return this.attendance.history(user, query);
  }

  /**
   * Same data as `history`, addressed as `GET /attendance` with either
   * `date=YYYY-MM-DD` (single day) or `from` + `to` (range).
   */
  @Get()
  @RequirePermission('attendance.read')
  byDateOrRange(
    @CurrentUser() user: AuthUser,
    @Query() query: AttendanceQueryDto & { date?: string },
  ) {
    if (query.date) {
      const day = query.date.slice(0, 10);
      return this.attendance.history(user, {
        ...query,
        from: `${day}T00:00:00.000Z`,
        to: `${day}T23:59:59.999Z`,
      });
    }
    return this.attendance.history(user, query);
  }

  @Get('calendar/:memberId')
  @RequirePermission('attendance.read')
  calendar(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const y = Number(year) || new Date().getUTCFullYear();
    const m = Number(month) || new Date().getUTCMonth() + 1;
    return this.attendance.calendar(user, memberId, y, m);
  }

  @Get('unmapped')
  @RequirePermission('attendance.read')
  unmapped(@CurrentUser() user: AuthUser, @Query() query: AttendanceQueryDto) {
    return this.attendance.unmapped(user, query);
  }

  @Post('manual')
  @RequirePermission('attendance.write')
  manual(@CurrentUser() user: AuthUser, @Body() dto: ManualCheckInDto) {
    return this.attendance.manualCheckIn(user, dto);
  }

  @Patch(':id')
  @RequirePermission('attendance.write')
  updateLog(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceLogDto,
  ) {
    return this.attendance.updateLog(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('attendance.write')
  deleteLog(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.deleteLog(user, id);
  }

  @Post('sync')
  @RequirePermission('devices.write')
  syncAll(@CurrentUser() user: AuthUser) {
    return this.attendance.syncAll(user);
  }

  @Post('sync/:memberId')
  @RequirePermission('devices.write')
  syncMember(@CurrentUser() user: AuthUser, @Param('memberId') memberId: string) {
    return this.attendance.syncMember(user, memberId);
  }

  // Devices
  @Get('devices')
  @RequirePermission('devices.read')
  devices(@CurrentUser() user: AuthUser) {
    return this.attendance.listDevices(user);
  }

  @Post('devices')
  @RequirePermission('devices.write')
  createDevice(@CurrentUser() user: AuthUser, @Body() dto: CreateDeviceDto) {
    return this.attendance.createDevice(user, dto);
  }

  @Post('devices/:id/ping')
  @RequirePermission('devices.write')
  pingDevice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.pingDevice(user, id);
  }

  @Patch('devices/:id')
  @RequirePermission('devices.write')
  updateDevice(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeviceDto,
  ) {
    return this.attendance.updateDevice(user, id, dto);
  }

  @Delete('devices/:id')
  @RequirePermission('devices.write')
  deleteDevice(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendance.deleteDevice(user, id);
  }
}
