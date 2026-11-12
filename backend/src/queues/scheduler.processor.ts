import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUES } from './queue.constants';
import { SchedulerService } from './scheduler.service';

@Processor(QUEUES.DIET)
export class DietSchedulerProcessor extends WorkerHost {
  constructor(private scheduler: SchedulerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'diet-reminder-tick') {
      await this.scheduler.runDietReminders();
    }
  }
}

@Processor(QUEUES.INVOICES)
export class InvoiceSchedulerProcessor extends WorkerHost {
  constructor(private scheduler: SchedulerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === 'due-invoice-tick') {
      await this.scheduler.markOverdueInvoices();
      await this.scheduler.runFeeReminders();
    }
  }
}
