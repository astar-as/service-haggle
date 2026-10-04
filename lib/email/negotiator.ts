import { coverageLines } from "../coverage";
import { competingOffers } from "../agents";
import { handleInboundMail } from "../mail";
import { store } from "../store";
import { handleDelegation, type DelegationResult } from "../strategist";
import type { Person, Policy, Turn } from "../types";
import { agentMail, MailNotConfiguredError, type MailClient, type MailMessage } from "./client";
import { brokerTick, ensureBrokerInboxes, isMockBroker } from "./brokers";
import {
  cleanReply,
  emailOf,
  mailTurnId,
  mergeTranscript,
  messageIdOf,
  refTag,
  type EmailCall,
} from "./thread";

export interface EmailOptions {
  client?: MailClient;
  pollMs?: number;
  silenceMs?: number;
  confirmWaitMs?: number;
  maxEmails?: number;
}

type Offer = Awaited<ReturnType<typeof competingOffers>>[number];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const g = globalThis as unknown as { __emailLines?: Map<string, Promise<void>> };

export async function runEmailNegotiation(callId: string, opts: EmailOptions = {}): Promise<void> {
  const active = (g.__emailLines ??= new Map());
  const existing = active.get(callId);
  if (existing) return existing;
  const run = new EmailLine(callId, opts).run().finally(() => active.delete(callId));
  active.set(callId, run);
  return run;
}

class EmailLine {
  private client!: MailClient;
  private inbox = "";
  private to = "";
  private call!: EmailCall;
  private policy!: Policy;
  private person!: Person;
  private ended = false;
  private failures = 0;
  private lastInboundAt = Date.now();
  private lastMessageId?: string;
  private sentIds = new Set<string>();
  private pollMs: number;
  private silenceMs: number;
  private confirmWaitMs: number;
  private maxEmails: number;

  constructor(
    private callId: string,
    private opts: EmailOptions,
  ) {
    this.pollMs = opts.pollMs ?? Number(process.env.EMAIL_POLL_MS ?? 3000);
    this.silenceMs = opts.silenceMs ?? Number(process.env.EMAIL_SILENCE_MS ?? 600_000);
    this.confirmWaitMs = opts.confirmWaitMs ?? this.silenceMs;
    this.maxEmails = opts.maxEmails ?? 8;
  }

  async run() {
    const call = (await store.call(this.callId)) as EmailCall | undefined;
    if (!call) throw new Error(`Call ${this.callId} not found`);
    this.call = call;
    if (call.status === "ended") return;
    const to = emailOf(call);
    if (!to) return this.finish("no_email_target: call.target must be mailto:<address>");
    this.to = to;
    try {
      this.client = this.opts.client ?? agentMail();
    } catch (e) {
      if (!(e instanceof MailNotConfiguredError)) throw e;
      console.error(`[email ${this.callId}] AGENTMAIL_API_KEY is not set; ending line`);
      return this.finish("agentmail_not_configured: set AGENTMAIL_API_KEY");
    }
    try {
      const [policy, person] = await Promise.all([store.policy(call.policyId), store.person()]);
      if (!policy) return this.finish(`policy_not_found: ${call.policyId}`);
      this.policy = policy;
      this.person = person;
      this.inbox = call.inbox ?? (await this.client.resolveInbox(person.inbox));
      for (const t of call.transcript) {
        const id = messageIdOf(t.id);
        if (!id) continue;
        this.lastMessageId = id;
        if (t.speaker === "agent") this.sentIds.add(id);
      }
      if (isMockBroker(to)) await ensureBrokerInboxes();
      if (!call.threadId) await this.open();
      else await this.patch({ status: "live", inbox: this.inbox });
      while (!this.ended) {
        await sleep(this.pollMs);
        await this.tick();
      }
    } catch (e) {
      console.error(`[email ${this.callId}]`, e);
      await this.finish(`error: ${errText(e)}`);
      throw e;
    }
  }

  private get first() {
    return this.person.firstName;
  }

  private greeting() {
    const name = this.call.counterpart.split(" · ")[0];
    return name && name !== this.call.insurer ? `Hi ${name},` : "Hello,";
  }

  private compose(body: string) {
    return [
      this.greeting(),
      "",
      body,
      "",
      "Thank you,",
      "Lowball",
      `AI assistant for ${this.person.name}`,
      refTag(this.callId),
    ].join("\n");
  }

  private facts() {
    const shareable = [...this.policy.facts, ...this.person.facts].filter(
      (f) => f.disclosure === "shareable",
    );
    return [
      `Coverage: ${this.policy.product}`,
      ...coverageLines(this.policy),
      ...shareable.map((f) => `${f.label}: ${f.value}`),
    ];
  }

  private async open() {
    const retention = this.call.role === "retention";
    const kind = String(this.policy.kind);
    let line: string;
    try {
      const r = await handleDelegation({
        callId: this.callId,
        policyId: this.call.policyId,
        request: "First email to the broker. They have not replied yet.",
        transcript: [],
      });
      line = r.say?.trim() || "";
    } catch (e) {
      console.error(`[email ${this.callId}] strategist failed on opener`, e);
      line = "";
    }
    if (!line) line = `What is the best monthly price you can offer for exactly this coverage?`;
    const intro = retention
      ? `I'm Lowball, an AI assistant writing on behalf of ${this.person.name}, a ${this.call.insurer} customer since ${this.policy.memberSince}. Her ${kind} policy renews on ${longDate(this.policy.renewsOn)} and she is reviewing her options before renewing.`
      : `I'm Lowball, an AI assistant writing on behalf of ${this.person.name}. She is comparing ${kind} insurance before her renewal on ${longDate(this.policy.renewsOn)} and would like a quote for identical coverage.`;
    const ask = `${line}\n\nA short reply with the monthly figure is perfect. ${this.first} reviews and signs anything herself.`;
    const text = this.compose(
      [intro, "", "Details:", ...this.facts().map((f) => `- ${f}`), "", ask].join("\n"),
    );
    const subject = retention
      ? `${this.person.name}'s ${kind} renewal: best price for the same coverage ${refTag(this.callId)}`
      : `Quote request: ${kind} insurance for ${this.person.name} ${refTag(this.callId)}`;
    const sent = await this.client.send(this.inbox, { to: this.to, subject, text });
    this.sentIds.add(sent.messageId);
    this.lastMessageId = sent.messageId;
    this.lastInboundAt = Date.now();
    await this.patch({ status: "live", inbox: this.inbox, threadId: sent.threadId }, [
      this.turn(sent.messageId, "agent", `${intro}\n\n${line}`),
    ]);
    await this.markLeverage();
  }

  private async markLeverage() {
    const offers = await competingOffers(this.callId).catch(() => [] as Offer[]);
    const best = offers
      .filter((o) => !o.agreed && o.monthly > 0)
      .sort((a, b) => a.monthly - b.monthly)[0];
    const used = this.call.leverageSent ?? [];
    if (best && !used.includes(best.monthly))
      await this.patch({ leverageSent: [...used, best.monthly] });
  }

  private turn(messageId: string, speaker: Turn["speaker"], text: string, at = now()): Turn {
    return { id: mailTurnId(messageId), speaker, text, at, final: true };
  }

  private async tick() {
    const fresh = (await store.call(this.callId).catch(() => undefined)) as EmailCall | undefined;
    if (!fresh) return;
    if (fresh.status === "ended") {
      this.ended = true;
      return;
    }
    this.call = fresh;

    // Demo brokers answer from their own AgentMail inboxes.
    if (isMockBroker(this.to))
      await brokerTick(this.callId, this.to, this.policy).catch((e) =>
        console.error(`[email ${this.callId}] mock broker failed`, errText(e)),
      );

    let msgs: MailMessage[];
    try {
      msgs = await this.client.messages(this.inbox, {
        threadId: fresh.threadId,
        ref: refTag(this.callId),
      });
      this.failures = 0;
    } catch (e) {
      console.error(`[email ${this.callId}] poll failed`, errText(e));
      if (++this.failures >= 20) await this.finish(`mail_error: ${errText(e)}`);
      return;
    }
    await this.ingest(msgs);

    const offers = await competingOffers(this.callId).catch(() => [] as Offer[]);
    const otherAgreed = offers.find((o) => o.agreed);
    if (otherAgreed && this.call.agreedMonthly === undefined) {
      await this.email(
        `Thank you for your time on this. ${this.first} has gone with another offer, so we'll leave it here for now. We appreciate your help.`,
      );
      return this.finish(`other_line_agreed: ${otherAgreed.insurer}`);
    }

    const answered = new Set(this.call.answered ?? []);
    const pending = this.call.transcript.filter(
      (t) => t.speaker === "counterpart" && !answered.has(t.id),
    );
    if (pending.length) {
      this.lastInboundAt = Date.now();
      return this.respond(pending);
    }

    if (await this.maybeLeverage(offers)) return;

    if (Date.now() - this.lastInboundAt > this.silenceMs) {
      await this.email(
        `Following up on the quote request below. Since we haven't heard back, we'll close this request for now. Thank you.`,
      );
      return this.finish("no_reply");
    }
  }

  private isOwn(m: MailMessage) {
    return this.sentIds.has(m.id) || m.from.toLowerCase().includes(this.inbox.toLowerCase());
  }

  private async ingest(msgs: MailMessage[]) {
    if (msgs.length) this.lastMessageId = msgs[msgs.length - 1].id;
    const known = new Set(this.call.transcript.map((t) => t.id));
    const fresh = msgs
      .filter((m) => !this.isOwn(m) && !known.has(mailTurnId(m.id)))
      .map((m) => this.turn(m.id, "counterpart", cleanReply(m.text), m.at))
      .filter((t) => t.text);
    if (fresh.length) await this.patch({}, fresh);
  }

  private async respond(pending: Turn[]) {
    const request = pending.map((t) => t.text).join("\n\n");
    let result: DelegationResult;
    try {
      result = await handleDelegation({
        callId: this.callId,
        policyId: this.call.policyId,
        request,
        transcript: this.call.transcript.map((t) => ({ ...t })),
      });
    } catch (e) {
      console.error(`[email ${this.callId}] strategist failed`, e);
      result = {
        say: `Thanks for getting back to me. Could you share the best monthly price you can offer ${this.first} for the same coverage?`,
      };
    }
    await this.apply(
      result,
      pending.map((t) => t.id),
    );
  }

  private async maybeLeverage(offers: Offer[]) {
    if (this.call.agreedMonthly !== undefined) return false;
    const ceiling = Math.min(
      this.call.theirOffer ?? Number.POSITIVE_INFINITY,
      this.policy.monthlyPremium,
    );
    const margin = Math.max(5, ceiling * 0.03);
    const best = offers
      .filter((o) => !o.agreed && o.monthly > 0 && o.monthly <= ceiling - margin)
      .sort((a, b) => a.monthly - b.monthly)[0];
    if (!best) return false;
    const used = this.call.leverageSent ?? [];
    if (used.some((m) => m <= best.monthly + 0.5)) return false;
    await this.patch({ leverageSent: [...used, best.monthly] });
    let result: DelegationResult;
    try {
      result = await handleDelegation({
        callId: this.callId,
        policyId: this.call.policyId,
        request:
          "No new reply from the broker. A lower offer just came in on another line; send one short follow-up using it.",
        transcript: this.call.transcript.map((t) => ({ ...t })),
      });
    } catch (e) {
      console.error(`[email ${this.callId}] strategist failed on leverage`, e);
      result = {
        say: `Quick update: ${this.first} has an offer of ${usd(best.monthly)} a month from another provider for the same coverage. Can you beat that?`,
      };
    }
    await this.apply(result, []);
    return true;
  }

  private async apply(result: DelegationResult, answered: string[]) {
    await this.refresh();
    if (result.agreedMonthly != null) {
      const agreed = result.agreedMonthly;
      await this.email(
        `Thank you, that works. ${this.first} would like to go ahead at ${usd(agreed)} a month for exactly the coverage in my first email (same limits and deductible).\n\nPlease reply to confirm ${usd(agreed)} a month in writing and send the policy documents to ${this.first} to review and e-sign. As her AI assistant I can't sign or pay on her behalf.`,
        { answered, agreedMonthly: agreed },
      );
      await this.recordConfirmation(agreed);
      await this.finish("agreed");
      return this.awaitConfirmation();
    }
    const say = result.say?.trim();
    if (say) await this.email(say, { answered });
    else if (answered.length)
      await this.patch({ answered: [...new Set([...(this.call.answered ?? []), ...answered])] });
    await this.markLeverage();
    if (result.endCall) return this.finish("walked");
    if (this.call.transcript.filter((t) => t.speaker === "agent").length >= this.maxEmails) {
      await this.email(
        `Thanks again for your help. We'll leave it here for now; ${this.first} will be in touch if anything changes.`,
      );
      return this.finish("max_rounds");
    }
  }

  private async email(body: string, extra: Partial<EmailCall> & { answered?: string[] } = {}) {
    const text = this.compose(body);
    const sent = this.lastMessageId
      ? await this.client.reply(this.inbox, this.lastMessageId, { to: this.to, text })
      : await this.client.send(this.inbox, {
          to: this.to,
          subject: `${this.policy.kind} insurance for ${this.person.name} ${refTag(this.callId)}`,
          text,
        });
    this.sentIds.add(sent.messageId);
    this.lastMessageId = sent.messageId;
    const { answered, ...rest } = extra;
    await this.patch(
      {
        ...rest,
        ...(answered?.length
          ? { answered: [...new Set([...(this.call.answered ?? []), ...answered])] }
          : {}),
      },
      [this.turn(sent.messageId, "agent", body)],
    );
  }

  private async recordConfirmation(agreed: number) {
    const id = `sig-mail-confirm-${this.callId}`;
    if ((await store.signals(this.policy.id)).some((s) => s.id === id)) return;
    await store.addSignal({
      id,
      personId: this.person.id,
      policyId: this.policy.id,
      at: now().slice(0, 10),
      source: "email",
      title: `${this.call.insurer} agreed to ${usd(agreed)}/mo by email. Asked them to confirm in writing.`,
      impactMonthly: Math.round(agreed - this.policy.monthlyPremium),
    });
  }

  private async awaitConfirmation() {
    const until = Date.now() + this.confirmWaitMs;
    const seen = new Set(this.call.transcript.map((t) => t.id));
    while (Date.now() < until) {
      await sleep(this.pollMs);
      let msgs: MailMessage[];
      try {
        msgs = await this.client.messages(this.inbox, {
          threadId: this.call.threadId,
          ref: refTag(this.callId),
        });
      } catch {
        continue;
      }
      const reply = msgs.find((m) => !this.isOwn(m) && !seen.has(mailTurnId(m.id)));
      if (!reply) continue;
      await this.patch({}, [
        this.turn(reply.id, "counterpart", cleanReply(reply.text) || reply.text, reply.at),
      ]);
      await handleInboundMail({
        event_type: "message.received",
        message: {
          from: reply.from,
          subject: reply.subject,
          text: reply.text,
          message_id: reply.id,
          thread_id: reply.threadId,
        },
      }).catch((e) => console.error(`[email ${this.callId}] confirmation handling failed`, e));
      return;
    }
  }

  private async refresh() {
    const fresh = (await store.call(this.callId).catch(() => undefined)) as EmailCall | undefined;
    if (fresh)
      this.call = { ...fresh, transcript: mergeTranscript(fresh.transcript, this.call.transcript) };
  }

  private async patch(update: Partial<EmailCall>, turns: Turn[] = []) {
    const fresh =
      ((await store.call(this.callId).catch(() => undefined)) as EmailCall | undefined) ??
      this.call;
    const next: EmailCall = {
      ...fresh,
      ...update,
      transcript: mergeTranscript(fresh.transcript, [...this.call.transcript, ...turns]),
    };
    this.call = next;
    await store.putCall(next);
  }

  private async finish(reason: string) {
    if (this.ended) return;
    this.ended = true;
    if (!this.call) return;
    await this.patch({ status: "ended", endedAt: now(), endReason: reason }).catch((e) =>
      console.error(`[email ${this.callId}] finish`, e),
    );
    console.log(`[email ${this.callId}] ended: ${reason}`);
  }
}
