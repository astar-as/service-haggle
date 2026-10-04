import { store } from "../store";
import type { Call, Turn } from "../types";

export type EmailCall = Call & {
  endReason?: string;
  inbox?: string;
  threadId?: string;
  answered?: string[];
  leverageSent?: number[];
};

export const REF = /\[(?:Service Haggle|Lowball) ref ([\w-]+)\]/i;
export const refTag = (callId: string) => `[Service Haggle ref ${callId}]`;
export const mailTurnId = (messageId: string) => `mail-${messageId}`;
export const messageIdOf = (turnId: string) => (turnId.startsWith("mail-") ? turnId.slice(5) : undefined);
export const emailOf = (call: Pick<Call, "target">) => (call.target?.startsWith("mailto:") ? call.target.slice(7) : undefined);

export function cleanReply(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*On .{3,200}wrote:\s*$/i.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^\s*From:\s.+@/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 2000);
}

export function mergeTranscript(base: Turn[], extra: Turn[]) {
  const byId = new Map(base.map((t) => [t.id, t]));
  for (const t of extra) if (!byId.has(t.id)) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
}

export async function appendInboundTurn(callId: string, msg: { messageId: string; text: string; at?: string }) {
  const call = (await store.call(callId)) as EmailCall | undefined;
  if (!call || call.channel !== "email") return { appended: false, reason: "not an email call" };
  const id = mailTurnId(msg.messageId);
  if (call.transcript.some((t) => t.id === id)) return { appended: false, reason: "duplicate" };
  const text = cleanReply(msg.text);
  if (!text) return { appended: false, reason: "empty" };
  const turn: Turn = { id, speaker: "counterpart", text, at: msg.at ?? new Date().toISOString(), final: true };
  await store.putCall({ ...call, transcript: mergeTranscript(call.transcript, [turn]) });
  return { appended: true };
}
