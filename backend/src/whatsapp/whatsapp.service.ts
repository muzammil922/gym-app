import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { QUEUES } from '../queues/queue.constants';
import {
  WhatsAppProvider,
} from './providers/whatsapp-provider.interface';
import { WHATSAPP_PROVIDER } from './whatsapp.constants';
import { EvolutionWhatsAppProvider } from './providers/evolution.provider';

const AUTOMATION_KEYS = {
  enabled: 'whatsapp_enabled',
  paymentDetailsInclude: 'payment_details_include',
  gymInfoInclude: 'gym_info_include',
} as const;

const TEMPLATE_KEYS = {
  welcomeTemplateReady: 'welcome',
  paymentReminderTemplateReady: 'fee_reminder',
  expiryReminderTemplateReady: 'expiry_reminder',
  dietReminderTemplateReady: 'diet_reminder',
} as const;

@Injectable()
export class WhatsAppService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private evolution: EvolutionWhatsAppProvider,
    @Inject(WHATSAPP_PROVIDER) private provider: WhatsAppProvider,
    @InjectQueue(QUEUES.WHATSAPP) private waQueue: Queue,
  ) {}

  async enqueue(params: {
    gymId: string;
    toPhone: string;
    body: string;
    templateKey?: string;
    idempotencyKey?: string;
    scheduledAt?: Date;
    payload?: Record<string, unknown>;
  }) {
    if (params.idempotencyKey) {
      const existing = await this.prisma.messageQueue.findFirst({
        where: { gymId: params.gymId, idempotencyKey: params.idempotencyKey },
      });
      if (existing) return { ...existing, idempotent: true };
    }

    const item = await this.prisma.messageQueue.create({
      data: {
        gymId: params.gymId,
        toPhone: params.toPhone,
        body: params.body,
        templateKey: params.templateKey,
        idempotencyKey: params.idempotencyKey,
        scheduledAt: params.scheduledAt || new Date(),
        payload: params.payload as Prisma.InputJsonValue,
        status: MessageStatus.QUEUED,
      },
    });

    const delay = Math.max(
      0,
      (params.scheduledAt?.getTime() || Date.now()) - Date.now(),
    );
    await this.waQueue.add(
      'send',
      { queueId: item.id },
      { jobId: item.idempotencyKey || item.id, delay, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return item;
  }

  async processQueueItem(queueId: string) {
    const item = await this.prisma.messageQueue.findUnique({ where: { id: queueId } });
    if (!item || item.status === MessageStatus.SENT || item.status === MessageStatus.CANCELLED) {
      return;
    }

    await this.prisma.messageQueue.update({
      where: { id: queueId },
      data: { status: MessageStatus.SENDING, attempts: { increment: 1 } },
    });

    const result = await this.provider.send({
      toPhone: item.toPhone,
      body: item.body,
      templateName: item.templateKey || undefined,
    });

    await this.prisma.messageLog.create({
      data: {
        gymId: item.gymId,
        queueId: item.id,
        toPhone: item.toPhone,
        providerMsgId: result.providerMessageId || null,
        status: result.status === 'SENT' ? MessageStatus.SENT : MessageStatus.FAILED,
        costEstimate: result.costEstimate,
        response: result.raw as Prisma.InputJsonValue,
        error: result.error,
        sentAt: result.status === 'SENT' ? new Date() : null,
      },
    });

    await this.prisma.messageQueue.update({
      where: { id: queueId },
      data: {
        status: result.status === 'SENT' ? MessageStatus.SENT : MessageStatus.FAILED,
        lastError: result.error,
      },
    });
  }

  async listTemplates(user: AuthUser) {
    return this.prisma.messageTemplate.findMany({
      where: { gymId: user.gymId },
      orderBy: { key: 'asc' },
    });
  }

  async upsertTemplate(
    user: AuthUser,
    data: {
      key: string;
      name: string;
      body: string;
      language?: string;
      metaTplId?: string;
      variables?: Record<string, unknown>;
    },
  ) {
    return this.prisma.messageTemplate.upsert({
      where: { gymId_key: { gymId: user.gymId, key: data.key } },
      create: {
        gymId: user.gymId,
        key: data.key,
        name: data.name,
        body: data.body,
        language: data.language || 'en',
        metaTplId: data.metaTplId,
        variables: data.variables as Prisma.InputJsonValue,
      },
      update: {
        name: data.name,
        body: data.body,
        language: data.language,
        metaTplId: data.metaTplId,
        variables: data.variables as Prisma.InputJsonValue,
      },
    });
  }

  async listAutomation(user: AuthUser) {
    return this.prisma.automationSetting.findMany({
      where: { gymId: user.gymId },
    });
  }

  async setAutomation(
    user: AuthUser,
    key: string,
    enabled: boolean,
    config?: Record<string, unknown>,
  ) {
    return this.prisma.automationSetting.upsert({
      where: { gymId_key: { gymId: user.gymId, key } },
      create: {
        gymId: user.gymId,
        key,
        enabled,
        config: config as Prisma.InputJsonValue,
      },
      update: { enabled, config: config as Prisma.InputJsonValue },
    });
  }

  async listLogs(user: AuthUser, page = 1, limit = 20) {
    const p = paginate(page, limit);
    const where = { gymId: user.gymId };
    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.messageLog.count({ where }),
    ]);
    return paginatedResponse(data, total, p.page, p.limit);
  }

  async retry(user: AuthUser, queueId: string) {
    const item = await this.prisma.messageQueue.findFirst({
      where: { id: queueId, gymId: user.gymId },
    });
    if (!item) throw new NotFoundException('Queue item not found');
    await this.prisma.messageQueue.update({
      where: { id: queueId },
      data: { status: MessageStatus.QUEUED, lastError: null },
    });
    await this.waQueue.add('send', { queueId }, { attempts: 3 });
    return { queued: true };
  }

  async costEstimate(user: AuthUser, from?: string, to?: string) {
    const where: Prisma.MessageLogWhereInput = {
      gymId: user.gymId,
      status: MessageStatus.SENT,
    };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const agg = await this.prisma.messageLog.aggregate({
      where,
      _sum: { costEstimate: true },
      _count: true,
    });
    return {
      currency: 'USD',
      messageCount: agg._count,
      estimatedCost: agg._sum.costEstimate || 0,
    };
  }

  verifyWebhook(mode: string, token: string, challenge: string) {
    return this.provider.verifyWebhook?.(mode, token, challenge) ?? null;
  }

  async handleWebhook(body: unknown) {
    const events = this.provider.parseWebhook?.(body) || [];
    for (const ev of events) {
      if (!ev.providerMessageId) continue;
      await this.prisma.messageLog.updateMany({
        where: { providerMsgId: ev.providerMessageId },
        data: {
          status:
            ev.status === 'DELIVERED'
              ? MessageStatus.DELIVERED
              : ev.status === 'FAILED'
                ? MessageStatus.FAILED
                : MessageStatus.SENT,
        },
      });
    }
    return { processed: events.length };
  }

  renderTemplate(body: string, vars: Record<string, string>) {
    return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
  }

  async getSettings(user: AuthUser) {
    const [automations, templates, connection] = await Promise.all([
      this.prisma.automationSetting.findMany({ where: { gymId: user.gymId } }),
      this.prisma.messageTemplate.findMany({ where: { gymId: user.gymId } }),
      this.fetchConnectionState(),
    ]);

    const auto = (key: string, defaultValue = false) =>
      automations.find((a) => a.key === key)?.enabled ?? defaultValue;

    const tplReady = (key: string) =>
      templates.some((t) => t.key === key && t.isActive && t.body.trim().length > 0);

    const envEnabled = this.config.get('WHATSAPP_ENABLED') === 'true';

    return {
      enabled: envEnabled && auto(AUTOMATION_KEYS.enabled, true),
      providerConnected: connection.connected,
      welcomeTemplateReady: tplReady(TEMPLATE_KEYS.welcomeTemplateReady),
      paymentReminderTemplateReady: tplReady(TEMPLATE_KEYS.paymentReminderTemplateReady),
      expiryReminderTemplateReady: tplReady(TEMPLATE_KEYS.expiryReminderTemplateReady),
      dietReminderTemplateReady: tplReady(TEMPLATE_KEYS.dietReminderTemplateReady),
      paymentDetailsInclude: auto(AUTOMATION_KEYS.paymentDetailsInclude),
      gymInfoInclude: auto(AUTOMATION_KEYS.gymInfoInclude),
    };
  }

  async updateSettings(user: AuthUser, body: Record<string, boolean | undefined>) {
    const ops: Array<Promise<unknown>> = [];
    if (body.enabled !== undefined) {
      ops.push(
        this.setAutomation(user, AUTOMATION_KEYS.enabled, body.enabled, undefined),
      );
    }
    if (body.paymentDetailsInclude !== undefined) {
      ops.push(
        this.setAutomation(
          user,
          AUTOMATION_KEYS.paymentDetailsInclude,
          body.paymentDetailsInclude,
        ),
      );
    }
    if (body.gymInfoInclude !== undefined) {
      ops.push(
        this.setAutomation(user, AUTOMATION_KEYS.gymInfoInclude, body.gymInfoInclude),
      );
    }
    if (ops.length) await Promise.all(ops);
    return this.getSettings(user);
  }

  async listMessages(user: AuthUser, page = 1, limit = 20) {
    const p = paginate(page, limit);
    const where = { gymId: user.gymId };
    const [logs, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: { createdAt: 'desc' },
        include: { queue: { select: { body: true, templateKey: true } } },
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    const data = await Promise.all(
      logs.map(async (log) => {
        const member = await this.prisma.member.findFirst({
          where: { gymId: user.gymId, phone: log.toPhone },
          select: { id: true, fullName: true },
        });
        return {
          id: log.id,
          memberId: member?.id,
          memberName: member?.fullName,
          phone: log.toPhone,
          template: log.queue?.templateKey || '',
          body: log.queue?.body || '',
          status: log.status.toLowerCase(),
          createdAt: log.createdAt.toISOString(),
          error: log.error || undefined,
        };
      }),
    );
    return paginatedResponse(data, total, p.page, p.limit);
  }

  private mapPublicConnection(state: {
    connected: boolean;
    state: string;
    qrcode?: string;
  }) {
    const qr = state.qrcode;
    const qrDataUrl =
      qr && !qr.startsWith('data:') ? `data:image/png;base64,${qr}` : qr;
    return {
      connected: state.connected,
      status: state.state,
      state: state.state,
      qrcode: state.qrcode,
      qrDataUrl,
    };
  }

  async getConnection() {
    const state = await this.fetchConnectionState();
    return this.mapPublicConnection(state);
  }

  async connectInstance() {
    await this.ensureEvolutionInstance();
    const state = await this.fetchConnectionState();
    if (state.connected) return this.mapPublicConnection(state);
    const connect = await this.fetchConnectQr();
    return this.mapPublicConnection(connect);
  }

  private async fetchConnectionState() {
    if (
      (this.config.get<string>('WHATSAPP_PROVIDER') || 'meta').toLowerCase() !==
      'evolution'
    ) {
      const metaOk =
        this.config.get('WHATSAPP_ENABLED') === 'true' &&
        !!this.config.get('WHATSAPP_ACCESS_TOKEN') &&
        !!this.config.get('WHATSAPP_PHONE_NUMBER_ID');
      return { connected: metaOk, state: metaOk ? 'open' : 'close' as const, qrcode: undefined as string | undefined };
    }

    const base = this.evolution.baseUrl();
    const instance = this.evolution.instanceName;
    if (!base || !this.config.get('EVOLUTION_API_KEY')) {
      return { connected: false, state: 'close' as const, qrcode: undefined as string | undefined };
    }

    try {
      const res = await fetch(
        `${base}/instance/connectionState/${encodeURIComponent(instance)}`,
        { headers: this.evolution.headers() },
      );
      const raw = (await res.json().catch(() => ({}))) as {
        instance?: { state?: string };
        state?: string;
      };
      const state = raw.instance?.state || raw.state || 'close';
      const connected = state === 'open';
      return { connected, state, qrcode: undefined as string | undefined };
    } catch {
      return { connected: false, state: 'close' as const, qrcode: undefined as string | undefined };
    }
  }

  private async fetchConnectQr() {
    const base = this.evolution.baseUrl();
    const instance = this.evolution.instanceName;
    if (!base) {
      return { connected: false, state: 'close' as const, qrcode: undefined as string | undefined };
    }
    try {
      const res = await fetch(
        `${base}/instance/connect/${encodeURIComponent(instance)}`,
        { headers: this.evolution.headers() },
      );
      const raw = (await res.json().catch(() => ({}))) as {
        base64?: string;
        qrcode?: { base64?: string };
        pairingCode?: string;
        instance?: { state?: string };
      };
      const qrcode = raw.base64 || raw.qrcode?.base64;
      const state = raw.instance?.state || (qrcode ? 'connecting' : 'close');
      return {
        connected: false,
        state,
        qrcode,
      };
    } catch {
      return { connected: false, state: 'close' as const, qrcode: undefined as string | undefined };
    }
  }

  private async ensureEvolutionInstance() {
    if (
      (this.config.get<string>('WHATSAPP_PROVIDER') || 'meta').toLowerCase() !==
      'evolution'
    ) {
      return;
    }
    const base = this.evolution.baseUrl();
    const instance = this.evolution.instanceName;
    if (!base || !this.config.get('EVOLUTION_API_KEY')) return;

    const state = await this.fetchConnectionState();
    if (state.state !== 'close' && state.state !== 'not_found') return;

    try {
      await fetch(`${base}/instance/create`, {
        method: 'POST',
        headers: this.evolution.headers(),
        body: JSON.stringify({
          instanceName: instance,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
        }),
      });
    } catch {
      // instance may already exist
    }
  }
}
