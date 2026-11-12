import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUES } from './queue.constants';
import { DeviceSyncProcessor } from './device-sync.processor';
import { SchedulerService } from './scheduler.service';
import {
  DietSchedulerProcessor,
  InvoiceSchedulerProcessor,
} from './scheduler.processor';
import { AttendanceModule } from '../attendance/attendance.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST') || 'localhost',
          port: Number(config.get('REDIS_PORT') || 6379),
          username: config.get('REDIS_USERNAME') || undefined,
          password: config.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.WHATSAPP },
      { name: QUEUES.DEVICE_SYNC },
      { name: QUEUES.DIET },
      { name: QUEUES.INVOICES },
    ),
    AttendanceModule,
    forwardRef(() => WhatsAppModule),
  ],
  providers: [
    DeviceSyncProcessor,
    SchedulerService,
    DietSchedulerProcessor,
    InvoiceSchedulerProcessor,
  ],
  exports: [BullModule, SchedulerService],
})
export class QueuesModule {}
