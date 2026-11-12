import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DietService } from './diet.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Diet')
@ApiBearerAuth()
@Controller('diet')
export class DietController {
  constructor(private diet: DietService) {}

  @Get('templates')
  @RequirePermission('diet.read')
  templates(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.diet.listTemplates(
      user,
      Number(page) || 1,
      Number(limit) || 20,
      search,
    );
  }

  @Post('templates')
  @RequirePermission('diet.write')
  createTemplate(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.diet.createTemplate(user, body as never);
  }

  @Delete('templates/:id')
  @RequirePermission('diet.write')
  deleteTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diet.deleteTemplate(user, id);
  }

  @Delete('assignments/:id')
  @RequirePermission('diet.write')
  deleteAssignment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.diet.deleteAssignment(user, id);
  }

  @Post('assign')
  @RequirePermission('diet.write')
  assign(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      memberId: string;
      templateId: string;
      startDate: string;
      endDate?: string;
      notes?: string;
      rebuildDays?: number;
    },
  ) {
    return this.diet.assign(user, body);
  }

  @Get('schedule/:memberId')
  @RequirePermission('diet.read')
  schedule(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.diet.memberSchedule(user, memberId, from, to);
  }

  @Post('schedule/:id/complete')
  @RequirePermission('diet.write')
  complete(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { completed?: boolean },
  ) {
    return this.diet.markComplete(user, id, body.completed ?? true);
  }
}
