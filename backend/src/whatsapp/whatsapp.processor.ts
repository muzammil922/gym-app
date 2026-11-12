import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '../queues/queue.constants';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor(QUEUES.WHATSAPP)
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(
    private wa: WhatsAppService,
    private prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'send') {
      await this.wa.processQueueItem(job.data.queueId);
      return;
    }
    if (job.name === 'welcome') {
      const { gymId, memberId, phone, fullName } = job.data as {
        gymId: string;
        memberId: string;
        phone: string;
        fullName: string;
      };
      const setting = await this.prisma.automationSetting.findUnique({
        where: { gymId_key: { gymId, key: 'welcome' } },
      });
      if (setting && !setting.enabled) return;

      const tpl = await this.prisma.messageTemplate.findUnique({
        where: { gymId_key: { gymId, key: 'welcome' } },
      });
      const body = this.wa.renderTemplate(
        tpl?.body || 'Welcome {{name}} to our gym!',
        { name: fullName },
      );
      await this.wa.enqueue({
        gymId,
        toPhone: phone,
        body,
        templateKey: 'welcome',
        idempotencyKey: `welcome-${memberId}`,
      });
      return;
    }
    if (job.name === 'fee-reminder') {
      const { gymId, phone, body, idempotencyKey } = job.data;
      await this.wa.enqueue({ gymId, toPhone: phone, body, idempotencyKey });
      return;
    }
    this.logger.warn(`Unknown WhatsApp job: ${job.name}`);
  }
}
