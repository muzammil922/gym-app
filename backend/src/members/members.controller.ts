import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { MembersService } from './members.service';
import { AttendanceService } from '../attendance/attendance.service';
import {
  AddMemberDto,
  ChangePlanDto,
  CreateMemberDto,
  FreezeMemberDto,
  MemberQueryDto,
  RenewMemberDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/roles.decorator';
import { STORAGE_ADAPTER } from '../storage/storage.module';
import { StorageAdapter } from '../storage/storage.interface';

@ApiTags('Members')
@ApiBearerAuth()
@Controller('members')
export class MembersController {
  constructor(
    private members: MembersService,
    private attendanceService: AttendanceService,
    @Inject(STORAGE_ADAPTER) private storage: StorageAdapter,
  ) {}

  @Get()
  @RequirePermission('members.read')
  list(@CurrentUser() user: AuthUser, @Query() query: MemberQueryDto) {
    return this.members.list(user, query);
  }

  @Get(':id')
  @RequirePermission('members.read')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.get(user, id);
  }

  @Get(':id/profile')
  @RequirePermission('members.read')
  profile(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.profile(user, id);
  }

  @Get(':id/payments')
  @RequirePermission('payments.read')
  payments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.listPayments(user, id);
  }

  @Get(':id/attendance')
  @RequirePermission('attendance.read')
  memberAttendance(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.listAttendance(user, id);
  }

  @Patch(':id/reminders')
  @RequirePermission('members.write')
  reminders(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.members.updateReminders(user, id, body.enabled);
  }

  @Post(':id/resync')
  @RequirePermission('devices.write')
  resync(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.attendanceService.syncMember(user, id);
  }

  @Post()
  @RequirePermission('members.write')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMemberDto) {
    return this.members.create(user, dto);
  }

  @Post('add')
  @RequirePermission('members.write')
  @ApiOperation({
    summary: 'Add member in one transaction (member+sub+offer+payment+invoice+jobs)',
  })
  add(@CurrentUser() user: AuthUser, @Body() dto: AddMemberDto) {
    return this.members.addMember(user, dto);
  }

  @Patch(':id')
  @RequirePermission('members.write')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.members.update(user, id, dto);
  }

  @Delete(':id')
  @RequirePermission('members.delete')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.softDelete(user, id);
  }

  @Post(':id/freeze')
  @RequirePermission('members.write')
  freeze(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: FreezeMemberDto,
  ) {
    return this.members.freeze(user, id, dto);
  }

  @Post(':id/unfreeze')
  @RequirePermission('members.write')
  unfreeze(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.members.unfreeze(user, id);
  }

  @Post(':id/renew')
  @RequirePermission('members.write')
  renew(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RenewMemberDto,
  ) {
    return this.members.renew(user, id, dto);
  }

  @Post(':id/change-plan')
  @RequirePermission('members.write')
  changePlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChangePlanDto,
  ) {
    return this.members.changePlan(user, id, dto);
  }

  @Post(':id/photo')
  @RequirePermission('members.write')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  async uploadPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const key = `members/${user.gymId}/${id}/${Date.now()}-${file.originalname}`;
    const stored = await this.storage.upload(key, file.buffer, file.mimetype);
    return this.members.setPhoto(user, id, stored.url);
  }
}
