import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkoutsService } from './workouts.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Workouts')
@ApiBearerAuth()
@Controller('workouts')
export class WorkoutsController {
  constructor(private workouts: WorkoutsService) {}

  @Get('exercises')
  @RequirePermission('workout.read')
  exercises(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.workouts.listExercises(
      user,
      Number(page) || 1,
      Number(limit) || 50,
      search,
    );
  }

  @Post('exercises')
  @RequirePermission('workout.write')
  createExercise(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.workouts.createExercise(user, body as never);
  }

  @Get('plans')
  @RequirePermission('workout.read')
  plans(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workouts.listPlans(user, Number(page) || 1, Number(limit) || 20);
  }

  @Post('plans')
  @RequirePermission('workout.write')
  createPlan(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.workouts.createPlan(user, body as never);
  }

  @Patch('plans/:id')
  @RequirePermission('workout.write')
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.workouts.updatePlan(user, id, body as never);
  }

  @Post('assign')
  @RequirePermission('workout.write')
  assign(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      memberId: string;
      workoutPlanId: string;
      startDate: string;
      endDate?: string;
    },
  ) {
    return this.workouts.assign(user, body);
  }

  @Post('logs')
  @RequirePermission('workout.write')
  log(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.workouts.logWorkout(user, body as never);
  }

  @Get('logs/:memberId')
  @RequirePermission('workout.read')
  memberLogs(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.workouts.memberLogs(
      user,
      memberId,
      Number(page) || 1,
      Number(limit) || 20,
    );
  }

  @Get('streak/:memberId')
  @RequirePermission('workout.read')
  streak(@CurrentUser() user: AuthUser, @Param('memberId') memberId: string) {
    return this.workouts.streak(user, memberId);
  }
}
