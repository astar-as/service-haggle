import { AgentMailClient } from "agentmail";
import { AgentMailAdapter } from "./email/client";
import { appendInboundTurn, REF, type EmailCall } from "./email/thread";
import { store } from "./store";
import type { Call, Signal } from "./types";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export const hasMail = () => !!process.env.AGENTMAIL_API_KEY;

let client: AgentMailClient | null = null;
function mail() {
  if (!process.env.AGENTMAIL_API_KEY) throw new Error("AGENTMAIL_API_KEY is not set");
  client ??= new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });
  return client;
}

async function inboxId() {
  const preferred = (await store.person()).inbox;
  if (process.env.AGENTMAIL_INBOX) return process.env.AGENTMAIL_INBOX;
  try {
    return await new AgentMailAdapter().resolveInbox(preferred);
  } catch {
    return preferred;
  }
}

export function brokerEmailFor(insurer: string) {
  try {
    const map = JSON.parse(process.env.BROKER_EMAILS ?? "{}") as Record<string, string>;
    if (map[insurer]) return map[insurer];
  } catch {}
  return process.env.BROKER_EMAIL;
}

const sent = new Set<string>();

export interface SendResult {
  ok: boolean;
  to?: string;
  messageId?: string;
  error?: string;
}

export async function sendConfirmation(call: Call): Promise<SendResult> {
  if (call.agreedMonthly === undefined) return { ok: false, error: "Call has no agreed price" };
  if (call.channel === "email") return { ok: true, error: "email lines confirm in their own thread" };
  if (sent.has(call.id)) return { ok: true };
  const signalId = `sig-mail-confirm-${call.id}`;
  const policy = await store.policy(call.policyId);
  if (!policy) return { ok: false, error: `Unknown policy ${call.policyId}` };
  if ((await store.signals(policy.id)).some((s) => s.id === signalId)) return { ok: true };
  const to = brokerEmailFor(call.insurer ?? policy.insurer);
  if (!to) return { ok: false, error: "BROKER_EMAIL is not set" };
  if (!hasMail()) return { ok: false, error: "AGENTMAIL_API_KEY is not set" };

  const person = await store.person();
  const insurer = call.insurer ?? policy.insurer;
  const retention = insurer === policy.insurer;
  const subject = `Confirming ${usd(call.agreedMonthly)}/mo for ${person.name}'s ${policy.kind} policy [Lowball ref ${call.id}]`;
  const lines = [
    `Hi${call.counterpart && !call.counterpart.startsWith(insurer) ? ` ${call.counterpart.split(" · ")[0]}` : ""},`,
    "",
    `Thanks for your time on the phone today. As discussed, ${insurer} agreed to the following for ${person.name}:`,
    "",
    `- Policy: ${policy.product}${retention ? ` (${insurer} customer since ${policy.memberSince})` : ""}`,
    `- New premium: ${usd(call.agreedMonthly)} a month${retention ? ` (currently ${usd(policy.monthlyPremium)})` : ""}`,
    `- Coverage: unchanged${policy.facts.find((f) => f.label === "Deductible") ? `, ${policy.facts.find((f) => f.label === "Deductible")!.value} deductible` : ""}`,
    `- Effective: ${retention ? `at renewal on ${longDate(policy.renewsOn)}` : "on the start date in your written offer"}`,
    "",
    `Please reply to this email to confirm these terms in writing. ${person.firstName} will review and sign any documents herself; I can't sign or pay on her behalf.`,
    "",
    "Thank you,",
    `Lowball, AI assistant for ${person.name}`,
  ];
  const res = await mail().inboxes.messages.send(await inboxId(), { to, subject, text: lines.join("\n") });
  sent.add(call.id);
  const signal: Signal = {
    id: signalId,
    personId: person.id,
    policyId: policy.id,
    at: new Date().toISOString().slice(0, 10),
    source: "email",
    title: `Emailed ${insurer} to confirm ${usd(call.agreedMonthly)}/mo in writing.`,
  };
  await store.addSignal(signal);
  return { ok: true, to, messageId: (res as { messageId?: string }).messageId };
}

interface InboundMessage {
  from: string;
  subject: string;
  text: string;
  messageId?: string;
  threadId?: string;
  at?: string;
}

function pick(o: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const k of keys) if (o && typeof o[k] === "string") return o[k] as string;
  return undefined;
}

export function parseInbound(body: unknown): { eventType?: string; message?: InboundMessage } {
  const b = (body ?? {}) as Record<string, unknown>;
  const eventType = pick(b, "event_type", "eventType");
  const m = (b.message ?? b.data ?? b) as Record<string, unknown>;
  const fromRaw = m.from ?? m.from_;
  const from = Array.isArray(fromRaw) ? String(fromRaw[0] ?? "") : String(fromRaw ?? "");
  const text = pick(m, "extracted_text", "extractedText", "text", "preview") ?? "";
  const subject = pick(m, "subject") ?? "";
  if (!from && !text && !subject) return { eventType };
  const ts = pick(m, "timestamp", "created_at", "createdAt");
  const at = ts && !Number.isNaN(Date.parse(ts)) ? new Date(ts).toISOString() : undefined;
  return { eventType, message: { from, subject, text, messageId: pick(m, "message_id", "messageId"), threadId: pick(m, "thread_id", "threadId"), at } };
}

const CONFIRM = /\b(confirm(ed)?|approved|agreed|that'?s correct|all set|locked in|we can do)\b/i;
const NEGATIVE = /\b(not confirm|cannot|can'?t|unable|declin|reject|no longer)\b/i;

export async function handleInboundMail(body: unknown) {
  const { eventType, message } = parseInbound(body);
  if (!message) return { handled: false, reason: "no message in payload" };
  if (eventType && eventType !== "message.received") return { handled: false, reason: `ignored ${eventType}` };
  const ref = message.subject.match(REF)?.[1] ?? message.text.match(REF)?.[1];
  const refCall = ref ? ((await store.call(ref)) as EmailCall | undefined) : undefined;
  const own = [process.env.AGENTMAIL_INBOX, (await store.person()).inbox, refCall?.inbox].filter((x): x is string => !!x).map((x) => x.toLowerCase());
  if (own.some((x) => message.from.toLowerCase().includes(x))) return { handled: false, reason: "own message" };

  const thread =
    refCall?.channel === "email" && message.messageId
      ? await appendInboundTurn(refCall.id, { messageId: message.messageId, text: message.text, at: message.at })
      : undefined;
  const signalId = `sig-mail-${message.messageId ?? Date.now().toString(36)}`;
  if (message.messageId && (await store.signals()).some((s) => s.id === signalId)) {
    return { handled: true, duplicate: true, callId: refCall?.id, ...(thread ? { appended: thread.appended } : {}) };
  }
  const policies = await store.policies();
  const haystack = `${message.subject} ${message.text}`.toLowerCase();
  const policy =
    (refCall && policies.find((p) => p.id === refCall.policyId)) ??
    policies.find((p) => haystack.includes(p.insurer.toLowerCase())) ??
    policies.find((p) => haystack.includes(String(p.kind)));
  const call =
    refCall ??
    (policy
      ? (await store.calls())
          .filter((c) => c.policyId === policy.id && c.agreedMonthly !== undefined)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
      : undefined);
  const person = await store.person();
  const sender = message.from.replace(/<.*>/, "").trim() || message.from;
  const at = new Date().toISOString().slice(0, 10);
  const confirmed = !!call?.agreedMonthly && CONFIRM.test(message.text) && !NEGATIVE.test(message.text);

  await store.addSignal({
    id: signalId,
    personId: person.id,
    policyId: policy?.id,
    at,
    source: "email",
    title: confirmed
      ? `${call!.insurer} confirmed ${usd(call!.agreedMonthly!)}/mo in writing.`
      : `Email from ${sender}: ${message.subject || message.text.slice(0, 80)}`,
  });

  if (confirmed && policy && call?.agreedMonthly !== undefined) {
    const previous = policy.monthlyPremium;
    const saved = Math.round(previous - call.agreedMonthly);
    const retention = call.insurer === policy.insurer;
    if (retention) await store.putPolicy({ ...policy, monthlyPremium: call.agreedMonthly });
    const stance = await store.stance(policy.id);
    await store.putStance({
      policyId: policy.id,
      verdict: "won",
      fairMonthly: stance?.fairMonthly ?? call.agreedMonthly,
      walkAwayMonthly: stance?.walkAwayMonthly,
      headline: `Won ${usd(saved)} a month off.`,
      detail: retention
        ? `${call.insurer} confirmed ${usd(call.agreedMonthly)} a month by email. Nothing left to push on.`
        : `${call.insurer} confirmed ${usd(call.agreedMonthly)} a month by email. ${person.firstName} signs the new policy; then I'll cancel the old one.`,
      activity: retention ? `won ${usd(saved)} off` : "waiting for your signature",
      updatedAt: new Date().toISOString(),
    });
    try {
      const { invalidateBrief } = await import("./strategist");
      invalidateBrief(policy.id);
    } catch {}
  }
  return { handled: true, confirmed, policyId: policy?.id, callId: call?.id, ...(thread ? { appended: thread.appended } : {}) };
}
