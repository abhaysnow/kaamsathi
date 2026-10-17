import type { AppConfig } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  readonly kind: 'dev-outbox' | 'resend';
  send(msg: MailMessage): Promise<void>;
}

/**
 * Development only: keeps the last few messages in memory so a developer can open the reset link
 * from GET /api/v1/dev/outbox. Nothing is written to logs. Config never enables it in production.
 */
export class DevOutboxMailer implements Mailer {
  readonly kind = 'dev-outbox' as const;
  private readonly messages: Array<MailMessage & { sentAt: string }> = [];

  async send(msg: MailMessage) {
    this.messages.unshift({ ...msg, sentAt: new Date().toISOString() });
    this.messages.length = Math.min(this.messages.length, 20);
  }
  list() {
    return [...this.messages];
  }
}

/** Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email). */
export class ResendMailer implements Mailer {
  readonly kind = 'resend' as const;
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(msg: MailMessage) {
    const res = await this.fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to: [msg.to], subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(10_000),
    });
    // Status only: the response body could echo the message (and its reset link).
    if (!res.ok) throw new Error(`email provider returned ${res.status}`);
  }
}

/**
 * Returns null when no provider is configured in production. Callers must then report that
 * reset email is unavailable instead of pretending a message was sent.
 */
export function createMailer(config: AppConfig): Mailer | null {
  if (config.email.provider === 'resend') {
    return new ResendMailer(config.email.resendApiKey, config.email.from);
  }
  return config.devOutboxEnabled ? new DevOutboxMailer() : null;
}
