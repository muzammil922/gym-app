import { Module } from '@nestjs/common';
import { AttendanceController } from './attendance.controller';
import { IclockController } from './iclock.controller';
import { AttendanceService } from './attendance.service';
import { ZkTecoAdmsAdapter } from './zkteco/zkteco-adms.adapter';
import { HikvisionIsapiAdapter } from './hikvision/hikvision-isapi.adapter';

@Module({
  controllers: [AttendanceController, IclockController],
  providers: [AttendanceService, ZkTecoAdmsAdapter, HikvisionIsapiAdapter],
  exports: [AttendanceService, ZkTecoAdmsAdapter],
})
export class AttendanceModule {}
