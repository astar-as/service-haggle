import { AgentMailClient } from "agentmail";

export interface MailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  text: string;
  at: string;
}

export interface Sent {
  messageId: string;
  threadId: string;
}

export interface MailClient {
  resolveInbox(preferred?: string): Promise<string>;
  send(inbox: string, msg: { to: string; subject: string; text: string }): Promise<Sent>;
  reply(inbox: string, messageId: string, msg: { to: string; text: string }): Promise<Sent>;
  messages(inbox: string, q: { threadId?: string; ref: string }): Promise<MailMessage[]>;
}

export class MailNotConfiguredError extends Error {
  constructor() {
    super("AGENTMAIL_API_KEY is not set");
    this.name = "MailNotConfiguredError";
  }
}

const INBOX_CLIENT_ID = "lowball-negotiator";

type RawMessage = {
  messageId: string;
  threadId: string;
  from: string;
  subject?: string;
  text?: string;
  extractedText?: string;
  preview?: string;
  timestamp?: Date | string;
  createdAt?: Date | string;
};

const iso = (d: Date | string | undefined) => (d ? new Date(d).toISOString() : new Date().toISOString());

function toMessage(m: RawMessage): MailMessage {
  return {
    id: m.messageId,
    threadId: m.threadId,
    from: m.from ?? "",
    subject: m.subject ?? "",
    text: m.extractedText || m.text || m.preview || "",
    at: iso(m.timestamp ?? m.createdAt),
  };
}

const g = globalThis as unknown as { __agentmailInbox?: Promise<string> };

export class AgentMailAdapter implements MailClient {
  private client: AgentMailClient;
  private cache = new Map<string, MailMessage>();

  constructor(apiKey = process.env.AGENTMAIL_API_KEY) {
    if (!apiKey) throw new MailNotConfiguredError();
    this.client = new AgentMailClient({ apiKey });
  }

  resolveInbox(preferred?: string) {
    if (process.env.AGENTMAIL_INBOX) return Promise.resolve(process.env.AGENTMAIL_INBOX);
    g.__agentmailInbox ??= this.findOrCreateInbox(preferred).catch((e) => {
      g.__agentmailInbox = undefined;
      throw e;
    });
    return g.__agentmailInbox;
  }

  private async findOrCreateInbox(preferred?: string) {
    if (preferred) {
      try {
        return (await this.client.inboxes.get(preferred)).inboxId;
      } catch {}
    }
    const displayName = "Lowball (AI assistant)";
    const username = preferred?.split("@")[0];
    if (username) {
      try {
        return (await this.client.inboxes.create({ username, displayName, clientId: INBOX_CLIENT_ID })).inboxId;
      } catch {}
    }
    try {
      return (await this.client.inboxes.create({ displayName, clientId: INBOX_CLIENT_ID })).inboxId;
    } catch (e) {
      const list = await this.client.inboxes.list({ limit: 100 });
      const hit = list.inboxes.find((i) => i.clientId === INBOX_CLIENT_ID) ?? list.inboxes[0];
      if (hit) return hit.inboxId;
      throw e;
    }
  }

  async send(inbox: string, msg: { to: string; subject: string; text: string }) {
    const r = await this.client.inboxes.messages.send(inbox, { to: msg.to, subject: msg.subject, text: msg.text });
    return { messageId: r.messageId, threadId: r.threadId };
  }

  async reply(inbox: string, messageId: string, msg: { to: string; text: string }) {
    const r = await this.client.inboxes.messages.reply(inbox, messageId, { to: msg.to, text: msg.text });
    return { messageId: r.messageId, threadId: r.threadId };
  }

  async messages(inbox: string, q: { threadId?: string; ref: string }) {
    const out = new Map<string, MailMessage>();
    if (q.threadId) {
      const thread = await this.client.inboxes.threads.get(inbox, q.threadId);
      for (const m of thread.messages ?? []) out.set(m.messageId, toMessage(m as RawMessage));
    }
    const found = await this.client.inboxes.messages.list(inbox, { subject: [q.ref], limit: 50 });
    for (const item of found.messages ?? []) {
      if (out.has(item.messageId)) continue;
      let full = this.cache.get(item.messageId);
      if (!full) {
        full = toMessage((await this.client.inboxes.messages.get(inbox, item.messageId)) as RawMessage);
        this.cache.set(full.id, full);
      }
      out.set(full.id, full);
    }
    return [...out.values()].sort((a, b) => a.at.localeCompare(b.at));
  }
}

export function agentMail(): MailClient {
  return new AgentMailAdapter();
}
