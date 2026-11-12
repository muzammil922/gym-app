import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DeviceVendor } from '@prisma/client';
import { QUEUES } from './queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ZkTecoAdmsAdapter } from '../attendance/zkteco/zkteco-adms.adapter';

@Processor(QUEUES.DEVICE_SYNC)
export class DeviceSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(DeviceSyncProcessor.name);

  constructor(
    private prisma: PrismaService,
    private zkteco: ZkTecoAdmsAdapter,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { gymId, memberId, devicePin } = job.data as {
      gymId: string;
      memberId?: string;
      devicePin?: string;
    };

    if (job.name === 'delete-member') {
      const devices = await this.prisma.attendanceDevice.findMany({
        where: { gymId, isActive: true, vendor: DeviceVendor.ZKTECO },
      });
      for (const d of devices) {
        if (devicePin) await this.zkteco.deleteUser(d.serialNumber, devicePin);
      }
      return;
    }

    if (job.name === 'sync-member' && memberId) {
      const member = await this.prisma.member.findFirst({
        where: { id: memberId, gymId },
      });
      if (!member?.devicePin) {
        this.logger.warn(`No PIN for member ${memberId}`);
        return;
      }
      const devices = await this.prisma.attendanceDevice.findMany({
        where: { gymId, isActive: true, vendor: DeviceVendor.ZKTECO },
      });
      for (const device of devices) {
        await this.zkteco.pushUser(device.serialNumber, {
          pin: member.devicePin,
          name: member.fullName,
        });
        await this.prisma.deviceUserMap.upsert({
          where: {
            deviceId_memberId: { deviceId: device.id, memberId: member.id },
          },
          create: {
            gymId,
            deviceId: device.id,
            memberId: member.id,
            devicePin: member.devicePin,
            syncStatus: 'QUEUED',
            syncedAt: new Date(),
          },
          update: {
            devicePin: member.devicePin,
            syncStatus: 'QUEUED',
            syncedAt: new Date(),
          },
        });
      }
    }
  }
}
