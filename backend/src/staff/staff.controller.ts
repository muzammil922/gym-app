import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { StaffService } from './staff.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Staff')
@ApiBearerAuth()
@Controller('staff')
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  @RequirePermission('staff.read')
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.staff.list(
      user,
      Number(page) || 1,
      Number(limit) || 20,
      search,
      role,
    );
  }

  @Get('attendance')
  @RequirePermission('staff.read')
  listAttendance(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.staff.listAttendance(user, date, from, to);
  }

  @Post('attendance')
  @RequirePermission('staff.write')
  markAttendance(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      staffId: string;
      date: string;
      status?: string;
      checkInAt?: string;
      checkOutAt?: string;
    },
  ) {
    return this.staff.markAttendance(user, body);
  }

  @Post()
  @RequirePermission('staff.write')
  create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      fullName: string;
      phone: string;
      email?: string;
      role: Role;
      salaryAmount?: number;
      password?: string;
      staffCode?: string;
      createLogin?: boolean;
    },
  ) {
    return this.staff.create(user, body);
  }

  @Patch(':id')
  @RequirePermission('staff.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.staff.update(user, id, body as never);
  }

  @Delete(':id')
  @RequirePermission('staff.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.staff.softDelete(user, id);
  }

  @Post('assign-trainer')
  @RequirePermission('staff.write')
  assignTrainer(
    @CurrentUser() user: AuthUser,
    @Body() body: { memberId: string; trainerStaffId: string | null },
  ) {
    return this.staff.assignTrainer(user, body.memberId, body.trainerStaffId);
  }

  @Put('salaries')
  @RequirePermission('staff.write')
  upsertSalary(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      staffId: string;
      periodMonth: number;
      periodYear: number;
      amount: number;
      paidAmount?: number;
      status?: string;
      notes?: string;
    },
  ) {
    return this.staff.upsertSalary(user, body);
  }

  @Get('salaries')
  @RequirePermission('staff.read')
  salaries(
    @CurrentUser() user: AuthUser,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.staff.listSalaries(
      user,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Get('attendance-summary')
  @RequirePermission('staff.read')
  attendance(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.staff.staffAttendanceSummary(user, from, to);
  }
}
