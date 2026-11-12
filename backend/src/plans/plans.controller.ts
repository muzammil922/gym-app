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
import { PlansService } from './plans.service';
import { CreatePlanDto, PlanQueryDto, UpdatePlanDto } from './dto/plan.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private plans: PlansService) {}

  @Get()
  @RequirePermission('plans.read')
  list(@CurrentUser() user: AuthUser, @Query() query: PlanQueryDto) {
    return this.plans.list(user, query);
  }

  @Get(':id')
  @RequirePermission('plans.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.get(user, id);
  }

  @Post()
  @RequirePermission('plans.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.plans.create(user, dto);
  }

  @Patch(':id')
  @RequirePermission('plans.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('plans.write')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plans.softDelete(user, id);
  }
}
