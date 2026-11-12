import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InvoiceStatus } from '@prisma/client';
import { QUEUES } from './queue.constants';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private wa: WhatsAppService,
    @InjectQueue(QUEUES.DIET) private dietQueue: Queue,
    @InjectQueue(QUEUES.INVOICES) private invoiceQueue: Queue,
  ) {}

  async onModuleInit() {
    await this.dietQueue.add(
      'diet-reminder-tick',
      {},
      {
        repeat: { every: 60 * 1000 },
        jobId: 'diet-reminder-tick',
        removeOnComplete: true,
      },
    );
    // Fee reminders + overdue marking (every hour)
    await this.invoiceQueue.add(
      'due-invoice-tick',
      {},
      {
        repeat: { every: 60 * 60 * 1000 },
        jobId: 'due-invoice-tick',
        removeOnComplete: true,
      },
    );
    this.logger.log('Scheduled repeatable jobs registered');
  }

  async runFeeReminders() {
    const gyms = await this.prisma.gym.findMany({ where: { isActive: true } });
    for (const gym of gyms) {
      const setting = await this.prisma.automationSetting.findUnique({
        where: { gymId_key: { gymId: gym.id, key: 'fee_reminder' } },
      });
      if (setting && !setting.enabled) continue;

      const dues = await this.prisma.invoice.findMany({
        where: {
          gymId: gym.id,
          dueAmount: { gt: 0 },
          status: {
            in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE],
          },
        },
        include: { member: true },
        take: 100,
      });

      const tpl = await this.prisma.messageTemplate.findUnique({
        where: { gymId_key: { gymId: gym.id, key: 'fee_reminder' } },
      });

      for (const inv of dues) {
        const body = this.wa.renderTemplate(
          tpl?.body ||
            'Hi {{name}}, your dues of {{amount}} PKR are pending (Invoice {{invoice}}).',
          {
            name: inv.member.fullName,
            amount: String(inv.dueAmount),
            invoice: inv.invoiceNumber,
          },
        );
        await this.wa.enqueue({
          gymId: gym.id,
          toPhone: inv.member.phone,
          body,
          templateKey: 'fee_reminder',
          idempotencyKey: `fee-${inv.id}-${new Date().toISOString().slice(0, 10)}`,
        });
      }
    }
  }

  async runDietReminders() {
    const now = new Date();
    // Asia/Karachi ≈ UTC+5 — schedule windows in UTC for simplicity
    const hourKarachi = (now.getUTCHours() + 5) % 24;
    if (![8, 13, 20].includes(hourKarachi)) return; // meal windows
    if (now.getUTCMinutes() > 1) return; // only first minute of hour

    const gyms = await this.prisma.gym.findMany({ where: { isActive: true } });
    for (const gym of gyms) {
      const setting = await this.prisma.automationSetting.findUnique({
        where: { gymId_key: { gymId: gym.id, key: 'diet_reminder' } },
      });
      if (setting && !setting.enabled) continue;

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const schedules = await this.prisma.memberDietSchedule.findMany({
        where: {
          gymId: gym.id,
          scheduleDate: today,
          completed: false,
        },
        include: { member: true },
        take: 200,
      });

      for (const s of schedules) {
        await this.wa.enqueue({
          gymId: gym.id,
          toPhone: s.member.phone,
          body: `Diet reminder: ${s.title} — ${s.foods}`,
          templateKey: 'diet_reminder',
          idempotencyKey: `diet-${s.id}-${hourKarachi}`,
        });
      }
    }
  }

  async markOverdueInvoices() {
    const now = new Date();
    await this.prisma.invoice.updateMany({
      where: {
        dueDate: { lt: now },
        dueAmount: { gt: 0 },
        status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL] },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
  }
}
