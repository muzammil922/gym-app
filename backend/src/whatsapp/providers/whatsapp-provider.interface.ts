export interface SendMessageInput {
  toPhone: string;
  body: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
}

export interface SendMessageResult {
  providerMessageId: string;
  status: 'SENT' | 'FAILED';
  raw?: unknown;
  error?: string;
  costEstimate?: number;
}

export interface WhatsAppProvider {
  send(input: SendMessageInput): Promise<SendMessageResult>;
  verifyWebhook?(mode: string, token: string, challenge: string): string | null;
  parseWebhook?(body: unknown): Array<{
    providerMessageId?: string;
    status?: string;
    toPhone?: string;
  }>;
}
