import { randomUUID } from "node:crypto";
import { competingOffers } from "../agents";
import { store } from "../store";
import { handleDelegation, type DelegationResult, reconcileAgreement } from "../strategist";
import type { Turn } from "../types";
import {
  callContext,
  E164,
  emitReflectedAudio,
  loadCall,
  voiceState,
  type ActiveNegotiation,
  type VoiceCall,
} from "./context";
import { createSipSession, hangupSession, sipTrunkFromEnv, VoiceError } from "./openai";
import { marketFact, marketInstruction, type MarketOffer } from "./prompt";
import {
  appendEvent,
  closeEvent,
  OUTBOUND_SIP_NOT_ENABLED,
  readReflectedAudio,
  ServerEvent,
  type LiveEvent,
} from "./protocol";
import { Sideband } from "./sideband";
import { endTwilioCall, placeTwilioCall, twilioFromEnv } from "./twilio";

const TURN_IDLE_MS = 1400;
const FLUSH_MS = 150;
const MARKET_POLL_MS = 1000;
const PAUSE_MS = 1200;
const PROMPT_WINDOW_MS = 20_000;
const MAX_APPEND_CHARS = 1500;

type Speaker = Turn["speaker"];
type GreetOwner = "browser" | "attach" | "answered";

export type PhoneMode = "sip" | "twilio";

export function phoneMode(): PhoneMode {
  const forced = process.env.VOICE_PHONE_MODE;
  if (forced === "sip" || forced === "twilio") return forced;
  if (sipTrunkFromEnv()) return "sip";
  if (twilioFromEnv()) return "twilio";
  throw new VoiceError(
    "Phone calling not configured: set SIP_PROVIDER_URL/SIP_USERNAME/SIP_PASSWORD/SIP_CALLER_NUMBER or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER/OPENAI_PROJECT_ID",
    501,
    "phone_not_configured",
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const eid = (p: string) => `${p}_${randomUUID().slice(0, 8)}`;

class Negotiation implements ActiveNegotiation {
  call!: VoiceCall;
  done: Promise<void>;
  private resolveDone!: () => void;
  private sideband?: Sideband;
  private sessionId?: string;
  private quote = false;
  private premium = Number.POSITIVE_INFINITY;
  private greeting = "";
  private greetOwner: GreetOwner = "attach";
  private greeted = false;
  private ended = false;
  private closing = false;
  private seen = new Set<string>();
  private open: Partial<Record<Speaker, { turnId: string; timer: ReturnType<typeof setTimeout> }>> =
    {};
  private lastOutputAt = 0;
  private lastInputAt = 0;
  private delegationSeq = 0;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private flushing: Promise<void> = Promise.resolve();
  private timers = new Set<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>();
  private announced = new Map<string, string>();
  private pendingPrompt?: { offer: MarketOffer; since: number };
  private reattaching = false;

  constructor(public callId: string) {
    this.done = new Promise((r) => (this.resolveDone = r));
  }

  async run() {
    const call = await loadCall(this.callId);
    if (!call) throw new VoiceError(`Call ${this.callId} not found`, 404, "call_not_found");
    this.call = call;
    if (call.status === "ended") return this.resolveDone();
    try {
      const ctx = await callContext(call);
      this.quote = ctx.quote;
      this.premium = ctx.policy.monthlyPremium;
      this.greeting = ctx.greeting;
      let sessionId: string | undefined;
      if (call.channel === "browser") {
        this.greetOwner = "browser";
        sessionId = await this.waitForSession(180_000);
      } else if (call.channel === "phone") {
        sessionId = await this.dial(ctx.instructions);
      } else
        throw new VoiceError(`Channel ${call.channel} is not a voice channel`, 400, "bad_channel");
      if (!sessionId) return await this.finish("no_session");
      this.sessionId = sessionId;
      if (this.call.sessionId !== sessionId) this.patch({ sessionId });
      await this.attach();
      if (this.greetOwner === "attach") this.markLive();
      if (this.greetOwner === "attach") this.greet();
      this.every(MARKET_POLL_MS, () => this.watchMarket());
      this.every(2000, () => this.watchExternalEnd());
      this.every(400, () => this.maybePromptMarket());
      await this.done;
    } catch (err) {
      await this.finish("error");
      throw err;
    }
  }

  private async dial(instructions: string) {
    const target = this.call.target;
    if (!target || !E164.test(target))
      throw new VoiceError(`Call ${this.callId} has no valid E.164 target`, 400, "bad_target");
    let mode = phoneMode();
    if (mode === "sip") {
      const trunk = sipTrunkFromEnv();
      if (!trunk) throw new VoiceError("SIP trunk env not set", 501, "sip_not_configured");
      try {
        const { sessionId } = await createSipSession(target, instructions, trunk);
        this.greetOwner = "answered";
        this.patch({ sessionId, status: "dialing" });
        return sessionId;
      } catch (err) {
        if (
          !(err instanceof VoiceError && err.code === OUTBOUND_SIP_NOT_ENABLED && twilioFromEnv())
        )
          throw err;
        console.warn(`[live ${this.callId}] outbound SIP not enabled, falling back to Twilio`);
        mode = "twilio";
      }
    }
    const twilioCallSid = await placeTwilioCall(target, this.callId);
    this.greetOwner = "attach";
    this.patch({ twilioCallSid, status: "dialing" });
    await this.flushing;
    return this.waitForSession(200_000);
  }

  private async waitForSession(timeoutMs: number) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const fresh = await loadCall(this.callId);
      if (!fresh || fresh.status === "ended") return undefined;
      if (fresh.sessionId) {
        this.call = {
          ...fresh,
          transcript: this.call.transcript.length ? this.call.transcript : fresh.transcript,
        };
        return fresh.sessionId;
      }
      await sleep(400);
    }
    return undefined;
  }

  private async attach(attempts = 6) {
    let lastErr: unknown;
    for (let i = 0; i < attempts; i++) {
      if (this.ended) return;
      const sb = new Sideband(
        this.sessionId!,
        (e) => this.onEvent(e),
        (code) => void this.onSidebandClosed(code),
      );
      try {
        await sb.connect();
        this.sideband = sb;
        return;
      } catch (err) {
        lastErr = err;
        await sleep(400 * (i + 1));
      }
    }
    throw lastErr;
  }

  private async onSidebandClosed(code: number) {
    if (this.ended || this.reattaching) return;
    this.reattaching = true;
    console.warn(`[live ${this.callId}] sideband closed (${code}), reattaching`);
    try {
      await this.attach(3);
    } catch {
      await this.finish("sideband_lost");
    } finally {
      this.reattaching = false;
    }
  }

  private send(event: object) {
    this.sideband?.send(event);
  }

  private onEvent(e: LiveEvent) {
    if (e.event_id) {
      if (this.seen.has(e.event_id)) return;
      this.seen.add(e.event_id);
    }
    const audio = readReflectedAudio(e);
    if (audio) return emitReflectedAudio(this.callId, audio);
    switch (e.type) {
      case ServerEvent.sessionStarted:
        this.markLive();
        break;
      case ServerEvent.inputTranscriptDelta:
        this.markLive();
        this.appendText("counterpart", e.delta);
        break;
      case ServerEvent.outputTranscriptDelta:
        this.markLive();
        this.appendText("agent", e.delta);
        break;
      case ServerEvent.delegationCreated:
        if (e.delegation?.id && (!e.delegation.target || e.delegation.target === "client"))
          void this.delegate(e.delegation.id);
        break;
      case ServerEvent.transportAnswered:
        this.markLive();
        if (this.greetOwner === "answered") this.greet();
        break;
      case ServerEvent.transportFailed:
        console.error(`[live ${this.callId}] transport failed`, e.error);
        void this.finish("transport_failed");
        break;
      case ServerEvent.sessionClosed:
        void this.finish(e.reason || "closed");
        break;
      case ServerEvent.error:
        console.error(`[live ${this.callId}] error`, e.error);
        break;
    }
  }

  private markLive() {
    if (this.call.status === "dialing" && !this.ended) this.patch({ status: "live" });
  }

  private greet() {
    if (this.greeted) return;
    this.greeted = true;
    this.send(appendEvent("instructions", this.greeting, null, eid("greeting")));
  }

  private appendText(speaker: Speaker, delta?: string) {
    if (!delta) return;
    if (speaker === "agent") this.lastOutputAt = Date.now();
    else this.lastInputAt = Date.now();
    const open = this.open[speaker];
    let turn = open && this.call.transcript.find((t) => t.id === open.turnId);
    if (!turn) {
      turn = { id: eid("turn"), speaker, text: "", at: now(), final: false };
      this.call.transcript.push(turn);
    }
    turn.text += delta;
    if (open) clearTimeout(open.timer);
    this.open[speaker] = {
      turnId: turn.id,
      timer: setTimeout(() => this.finalizeTurn(speaker), TURN_IDLE_MS),
    };
    this.scheduleFlush();
  }

  private finalizeTurn(speaker: Speaker) {
    const open = this.open[speaker];
    if (!open) return;
    clearTimeout(open.timer);
    delete this.open[speaker];
    const idx = this.call.transcript.findIndex((t) => t.id === open.turnId);
    if (idx < 0) return;
    const turn = this.call.transcript[idx];
    turn.text = turn.text.trim();
    if (!turn.text) this.call.transcript.splice(idx, 1);
    else turn.final = true;
    this.scheduleFlush();
  }

  private async delegate(delegationId: string) {
    const seq = ++this.delegationSeq;
    const transcript = this.call.transcript.map((t) => ({ ...t }));
    const last = [...transcript].reverse().find((t) => t.speaker === "counterpart");
    const request = last?.text.trim() || "The call just connected. What should I open with?";
    let result: DelegationResult;
    try {
      result = await handleDelegation({
        callId: this.callId,
        policyId: this.call.policyId,
        request,
        transcript,
      });
    } catch (err) {
      console.error(`[live ${this.callId}] strategist failed`, err);
      result = {
        say: "I'm still checking on that. Could you tell me the best monthly price you can offer?",
      };
    }
    if (this.ended) return;
    const update: Partial<VoiceCall> = {};
    if (result.theirOffer != null) update.theirOffer = result.theirOffer;
    if (result.ask != null) update.ask = result.ask;
    if (result.agreedMonthly != null) update.agreedMonthly = result.agreedMonthly;
    if (result.citing?.length)
      update.citing = [...new Set([...this.call.citing, ...result.citing])];
    if (Object.keys(update).length) this.patch(update, true);
    const superseded = seq !== this.delegationSeq;
    if (superseded && result.agreedMonthly == null && !result.endCall) return;
    const say = result.say?.trim().slice(0, MAX_APPEND_CHARS);
    if (say) this.send(appendEvent("commentary", say, delegationId, eid("result")));
    if (result.agreedMonthly != null)
      this.send(
        appendEvent(
          "thinking",
          `Agreement reached at $${result.agreedMonthly} a month. After confirming it, follow your closing instructions.`,
          delegationId,
          eid("agreed"),
        ),
      );
    if (result.endCall) this.endAfterSpeech();
  }

  private endAfterSpeech() {
    const started = Date.now();
    const tick = () => {
      if (this.ended || this.closing) return;
      const spoke = this.lastOutputAt > started + 500;
      const quiet = Date.now() - this.lastOutputAt;
      if ((spoke && quiet > 2500) || Date.now() - started > 30_000) void this.hangup("agreement");
      else this.after(500, tick);
    };
    this.after(2000, tick);
  }

  private async watchMarket() {
    if (this.ended || this.closing || this.call.status !== "live") return;
    if (!this.greeted && this.greetOwner !== "browser") return;
    let offers: Awaited<ReturnType<typeof competingOffers>>;
    try {
      offers = await competingOffers(this.callId);
    } catch {
      return;
    }
    const ceiling = Math.min(this.call.theirOffer ?? Number.POSITIVE_INFINITY, this.premium);
    const fresh = offers.filter((o) => {
      const key = `${o.monthly}:${o.agreed}`;
      return this.announced.get(o.callId) !== key && o.monthly < ceiling;
    });
    if (!fresh.length || this.call.agreedMonthly != null) return;
    for (const o of offers) this.announced.set(o.callId, `${o.monthly}:${o.agreed}`);
    const best = [...fresh].sort(
      (a, b) => a.monthly - b.monthly || Number(b.agreed) - Number(a.agreed),
    )[0];
    const offer: MarketOffer = {
      insurer: best.insurer,
      monthly: best.monthly,
      agreed: best.agreed,
    };
    this.send(appendEvent("thinking", marketFact(offer), null, eid("market")));
    this.pendingPrompt = { offer, since: Date.now() };
  }

  private maybePromptMarket() {
    const p = this.pendingPrompt;
    if (!p || this.ended || this.closing) return;
    if (Date.now() - p.since > PROMPT_WINDOW_MS || this.call.agreedMonthly != null) {
      this.pendingPrompt = undefined;
      return;
    }
    const quiet = Date.now() - Math.max(this.lastInputAt, this.lastOutputAt);
    if (quiet < PAUSE_MS) return;
    this.pendingPrompt = undefined;
    this.send(
      appendEvent("instructions", marketInstruction(p.offer, this.quote), null, eid("leverage")),
    );
  }

  private async watchExternalEnd() {
    if (this.ended || this.closing) return;
    const fresh = await loadCall(this.callId).catch(() => undefined);
    if (fresh?.status === "ended") void this.hangup("external");
  }

  async hangup(reason = "hangup") {
    if (this.ended || this.closing) return this.done;
    this.closing = true;
    if (!this.sideband || !this.sessionId) {
      await this.finish(reason);
      return this.done;
    }
    this.send(closeEvent(eid("close")));
    this.after(8000, async () => {
      if (this.ended) return;
      await hangupSession(this.sessionId!).catch((e) =>
        console.error(`[live ${this.callId}] hangup api`, e),
      );
      this.after(4000, () => void this.finish(reason));
    });
    return this.done;
  }

  async finish(reason: string) {
    if (this.ended) return;
    this.ended = true;
    for (const s of Object.keys(this.open) as Speaker[]) this.finalizeTurn(s);
    for (const t of this.timers) clearTimeout(t as ReturnType<typeof setTimeout>);
    this.timers.clear();
    this.sideband?.close();
    if (this.call.twilioCallSid) void endTwilioCall(this.call.twilioCallSid);
    this.call.status = "ended";
    this.call.endedAt = now();
    this.call.endReason = reason;
    await this.flush();
    await reconcileAgreement(this.callId).catch((e) =>
      console.error(`[live ${this.callId}] agreement check failed`, e),
    );
    this.resolveDone();
  }

  private patch(update: Partial<VoiceCall>, immediate = false) {
    Object.assign(this.call, update);
    if (immediate) void this.flush();
    else this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = undefined;
      void this.flush();
    }, FLUSH_MS);
  }

  private flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }
    const snapshot = structuredClone(this.call);
    this.flushing = this.flushing
      .then(() => store.putCall(snapshot))
      .catch((e) => console.error(`[live ${this.callId}] putCall`, e));
    return this.flushing;
  }

  private after(ms: number, fn: () => unknown) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private every(ms: number, fn: () => unknown) {
    let busy = false;
    const t = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        await fn();
      } finally {
        busy = false;
      }
    }, ms);
    this.timers.add(t);
  }
}

export async function runNegotiation(callId: string): Promise<void> {
  const { active } = voiceState();
  const existing = active.get(callId);
  if (existing) return existing.done;
  const n = new Negotiation(callId);
  active.set(callId, n);
  try {
    await n.run();
  } finally {
    active.delete(callId);
  }
}
