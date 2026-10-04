import { EventEmitter } from "node:events";
import { store } from "../store";
import type { Call } from "../types";
import { VoiceError } from "./openai";
import { buildInstructions, greetingInstruction, isQuote } from "./prompt";
import type { ReflectedAudio } from "./protocol";

export type VoiceCall = Call & { sessionId?: string; twilioCallSid?: string; endReason?: string };

export interface ActiveNegotiation {
  hangup(reason?: string): Promise<void>;
  done: Promise<void>;
}

const g = globalThis as unknown as {
  __voice?: { active: Map<string, ActiveNegotiation>; audio: EventEmitter; webhooks: Set<string> };
};

export function voiceState() {
  if (!g.__voice) {
    const audio = new EventEmitter();
    audio.setMaxListeners(200);
    g.__voice = { active: new Map(), audio, webhooks: new Set() };
  }
  return g.__voice;
}

export function onReflectedAudio(callId: string, fn: (a: ReflectedAudio) => void) {
  const { audio } = voiceState();
  audio.on(callId, fn);
  return () => {
    audio.off(callId, fn);
  };
}

export function emitReflectedAudio(callId: string, a: ReflectedAudio) {
  const { audio } = voiceState();
  if (audio.listenerCount(callId) > 0) audio.emit(callId, a);
}

export function putVoiceCall(call: VoiceCall) {
  return store.putCall(call);
}

export async function loadCall(callId: string) {
  return (await store.call(callId)) as VoiceCall | undefined;
}

export async function callContext(call: Call) {
  const [policy, person] = await Promise.all([store.policy(call.policyId), store.person()]);
  if (!policy) throw new VoiceError(`Policy ${call.policyId} not found`, 404, "policy_not_found");
  if (!person) throw new VoiceError("Person not found", 404, "person_not_found");
  return {
    policy,
    person,
    quote: isQuote(policy, call),
    instructions: buildInstructions(person, policy, call),
    greeting: greetingInstruction(person, policy, call),
  };
}

export const E164 = /^\+[1-9]\d{6,14}$/;
