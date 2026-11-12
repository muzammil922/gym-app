import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { QUEUES } from '../queues/queue.constants';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [
    AttendanceModule,
    BullModule.registerQueue(
      { name: QUEUES.DEVICE_SYNC },
      { name: QUEUES.WHATSAPP },
    ),
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
