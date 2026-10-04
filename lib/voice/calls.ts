import { keepAlive } from "../background";
import { randomUUID } from "node:crypto";
import { store } from "../store";
import type { Call } from "../types";
import { callContext, E164, loadCall, putVoiceCall, voiceState, type VoiceCall } from "./context";
import { phoneMode, runNegotiation } from "./negotiator";
import { acceptSession, apiKey, createWebrtcSession, hangupSession, rejectSession, VoiceError } from "./openai";
import { CALL_HEADER } from "./protocol";
import { endTwilioCall } from "./twilio";

export interface NewCall {
  policyId: string;
  channel: "browser" | "phone";
  target?: string;
  insurer?: string;
  counterpart?: string;
  role?: Call["role"];
  roundId?: string;
}

export async function createCall(input: NewCall): Promise<VoiceCall> {
  const policy = await store.policy(input.policyId);
  if (!policy) throw new VoiceError(`Policy ${input.policyId} not found`, 404, "policy_not_found");
  if (input.channel === "phone" && (!input.target || !E164.test(input.target)))
    throw new VoiceError("A phone call needs target in E.164 format, e.g. +14155550123", 400, "bad_target");
  const insurer = input.insurer || policy.insurer;
  const call: VoiceCall = {
    id: `call-${randomUUID().slice(0, 8)}`,
    policyId: policy.id,
    roundId: input.roundId,
    insurer,
    role: input.role ?? (insurer === policy.insurer ? "retention" : "quote"),
    status: "dialing",
    channel: input.channel,
    target: input.target,
    counterpart: input.counterpart || insurer,
    startedAt: new Date().toISOString(),
    citing: [],
    transcript: [],
  };
  await putVoiceCall(call);
  return call;
}

function runInBackground(callId: string) {
  keepAlive(runNegotiation(callId).catch(async (e) => {
    console.error(`[live ${callId}]`, e);
    const call = await loadCall(callId);
    if (call && call.status !== "ended") await putVoiceCall({ ...call, status: "ended", endedAt: new Date().toISOString() });
  }));
}

export async function startBrowserCall(input: { sdp: string; callId?: string; policyId?: string }) {
  apiKey();
  let call: VoiceCall | undefined;
  if (input.callId) {
    call = await loadCall(input.callId);
    if (!call) throw new VoiceError(`Call ${input.callId} not found`, 404, "call_not_found");
    if (call.status === "ended") throw new VoiceError(`Call ${input.callId} already ended`, 409, "call_ended");
    if (call.sessionId) throw new VoiceError(`Call ${input.callId} already has a session`, 409, "call_in_progress");
    if (call.channel !== "browser") call = { ...call, channel: "browser" };
  } else if (input.policyId) {
    call = await createCall({ policyId: input.policyId, channel: "browser" });
  } else throw new VoiceError("Provide callId or policyId", 400, "bad_request");
  const ctx = await callContext(call);
  try {
    const { sessionId, sdp } = await createWebrtcSession(input.sdp, ctx.instructions);
    await putVoiceCall({ ...call, sessionId });
    runInBackground(call.id);
    return { callId: call.id, sessionId, sdp, greeting: ctx.greeting };
  } catch (err) {
    await putVoiceCall({ ...call, status: "ended", endedAt: new Date().toISOString() });
    throw err;
  }
}

export async function startPhoneCall(input: Omit<NewCall, "channel"> & { callId?: string }) {
  apiKey();
  const mode = phoneMode();
  const call = input.callId ? await loadCall(input.callId) : await createCall({ ...input, channel: "phone" });
  if (!call) throw new VoiceError(`Call ${input.callId} not found`, 404, "call_not_found");
  runInBackground(call.id);
  return { callId: call.id, mode };
}

export async function hangupCall(callId: string) {
  const local = voiceState().active.get(callId);
  if (local) {
    void local.hangup("user");
    return { via: "local" };
  }
  const call = await loadCall(callId);
  if (!call) throw new VoiceError(`Call ${callId} not found`, 404, "call_not_found");
  if (call.status === "ended") return { via: "noop" };
  if (call.sessionId) {
    try {
      await hangupSession(call.sessionId);
      return { via: "api" };
    } catch (e) {
      console.error(`[live ${callId}] hangup api`, e);
    }
  }
  if (call.twilioCallSid) await endTwilioCall(call.twilioCallSid);
  await putVoiceCall({ ...call, status: "ended", endedAt: new Date().toISOString(), endReason: "user" });
  return { via: "store" };
}

function headerValue(headers: { name: string; value: string }[], name: string) {
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value?.trim();
}

function callIdFromHeaders(headers: { name: string; value: string }[]) {
  const direct = headerValue(headers, CALL_HEADER);
  if (direct) return decodeURIComponent(direct);
  for (const h of headers) {
    const m = h.value?.match(new RegExp(`${CALL_HEADER}=([^;&>\\s]+)`, "i"));
    if (m) return decodeURIComponent(m[1]);
  }
  return undefined;
}

export async function acceptIncoming(sessionId: string, headers: { name: string; value: string }[]) {
  const callId = callIdFromHeaders(headers);
  let call = callId ? await loadCall(callId) : undefined;
  if (!call) {
    const cutoff = Date.now() - 5 * 60_000;
    const pending = ((await store.calls()) as VoiceCall[])
      .filter((c) => c.channel === "phone" && c.twilioCallSid && !c.sessionId && c.status === "dialing" && Date.parse(c.startedAt) > cutoff)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    call = pending[0];
  }
  if (!call || call.status === "ended") {
    console.warn(`[live] rejecting unmatched incoming session ${sessionId}`, headers);
    await rejectSession(sessionId, 603).catch((e) => console.error("[live] reject", e));
    return null;
  }
  const ctx = await callContext(call);
  await acceptSession(sessionId, ctx.instructions);
  const fresh = (await loadCall(call.id)) ?? call;
  await putVoiceCall({ ...fresh, sessionId });
  return call.id;
}
