import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SendMessageInput,
  SendMessageResult,
  WhatsAppProvider,
} from './whatsapp-provider.interface';

@Injectable()
export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MetaCloudWhatsAppProvider.name);
  private readonly enabled: boolean;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;
  private readonly verifyToken: string;
  private readonly costPerMessage: number;

  constructor(private config: ConfigService) {
    this.enabled = config.get('WHATSAPP_ENABLED') === 'true';
    this.phoneNumberId = config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || '';
    this.accessToken = config.get<string>('WHATSAPP_ACCESS_TOKEN') || '';
    this.apiVersion = config.get<string>('WHATSAPP_API_VERSION') || 'v21.0';
    this.verifyToken = config.get<string>('WHATSAPP_VERIFY_TOKEN') || '';
    this.costPerMessage = Number(config.get('WHATSAPP_COST_PER_MESSAGE') || 0.005);
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const to = this.normalizePhone(input.toPhone);
    if (!this.enabled || !this.phoneNumberId || !this.accessToken) {
      this.logger.warn(`WhatsApp disabled/stub — would send to ${to}: ${input.body.slice(0, 80)}`);
      return {
        providerMessageId: `stub-${Date.now()}`,
        status: 'SENT',
        costEstimate: this.costPerMessage,
        raw: { stub: true },
      };
    }

    const url = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const payload = input.templateName
      ? {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: input.templateName,
            language: { code: input.templateLanguage || 'en' },
            components: input.templateParams?.length
              ? [
                  {
                    type: 'body',
                    parameters: input.templateParams.map((t) => ({
                      type: 'text',
                      text: t,
                    })),
                  },
                ]
              : undefined,
          },
        }
      : {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: input.body },
        };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const raw = await res.json();
      if (!res.ok) {
        return {
          providerMessageId: '',
          status: 'FAILED',
          error: JSON.stringify(raw),
          raw,
          costEstimate: 0,
        };
      }
      const id = raw?.messages?.[0]?.id || `meta-${Date.now()}`;
      return {
        providerMessageId: id,
        status: 'SENT',
        raw,
        costEstimate: this.costPerMessage,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'send failed';
      return {
        providerMessageId: '',
        status: 'FAILED',
        error: message,
        costEstimate: 0,
      };
    }
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge;
    return null;
  }

  parseWebhook(body: unknown) {
    const events: Array<{
      providerMessageId?: string;
      status?: string;
      toPhone?: string;
    }> = [];
    const entry = (body as { entry?: unknown[] })?.entry || [];
    for (const e of entry as Array<{ changes?: unknown[] }>) {
      for (const change of e.changes || []) {
        const value = (change as { value?: { statuses?: unknown[] } }).value;
        for (const st of value?.statuses || []) {
          const s = st as { id?: string; status?: string; recipient_id?: string };
          events.push({
            providerMessageId: s.id,
            status: s.status?.toUpperCase(),
            toPhone: s.recipient_id,
          });
        }
      }
    }
    return events;
  }

  private normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('92')) return digits;
    if (digits.startsWith('0')) return `92${digits.slice(1)}`;
    return digits;
  }
}
