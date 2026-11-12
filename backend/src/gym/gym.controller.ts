import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GymService } from './gym.service';
import { UpdateGymDto } from './dto/gym.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';

@ApiTags('Gym')
@ApiBearerAuth()
@Controller('gym')
export class GymController {
  constructor(private gym: GymService) {}

  @Get()
  @RequirePermission('dashboard.read')
  get(@CurrentUser() user: AuthUser) {
    return this.gym.getProfile(user);
  }

  @Put()
  @RequirePermission('settings.write')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateGymDto) {
    return this.gym.updateProfile(user, dto);
  }
}
