import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SendMessageInput,
  SendMessageResult,
  WhatsAppProvider,
} from './whatsapp-provider.interface';

@Injectable()
export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(EvolutionWhatsAppProvider.name);
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;
  private readonly enabled: boolean;
  private readonly costPerMessage: number;

  constructor(private config: ConfigService) {
    this.serverUrl = (config.get<string>('EVOLUTION_SERVER_URL') || '').replace(/\/$/, '');
    this.apiKey = config.get<string>('EVOLUTION_API_KEY') || '';
    this.instance = config.get<string>('EVOLUTION_INSTANCE') || 'gym';
    this.enabled = config.get('WHATSAPP_ENABLED') === 'true';
    this.costPerMessage = Number(config.get('WHATSAPP_COST_PER_MESSAGE') || 0.005);
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const to = this.normalizePhone(input.toPhone);
    if (!this.enabled || !this.serverUrl || !this.apiKey) {
      this.logger.warn(
        `Evolution WhatsApp disabled/stub — would send to ${to}: ${input.body.slice(0, 80)}`,
      );
      return {
        providerMessageId: `evo-stub-${Date.now()}`,
        status: 'SENT',
        costEstimate: this.costPerMessage,
        raw: { stub: true },
      };
    }

    const url = `${this.serverUrl}/message/sendText/${encodeURIComponent(this.instance)}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: to,
          text: input.body,
        }),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          providerMessageId: '',
          status: 'FAILED',
          error: JSON.stringify(raw),
          raw,
          costEstimate: 0,
        };
      }
      const id =
        (raw as { key?: { id?: string } })?.key?.id ||
        (raw as { messageId?: string })?.messageId ||
        `evo-${Date.now()}`;
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

  get instanceName() {
    return this.instance;
  }

  headers(): Record<string, string> {
    return {
      apikey: this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  baseUrl() {
    return this.serverUrl;
  }

  private normalizePhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('92')) return digits;
    if (digits.startsWith('0')) return `92${digits.slice(1)}`;
    return digits;
  }
}
