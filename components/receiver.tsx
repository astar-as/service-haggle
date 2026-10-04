"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Call, StoreEvent } from "@/lib/types";
import { usd } from "@/lib/view";
import { useLiveCall } from "@/lib/voice/useLiveCall";
import { Phone } from "./icons";

type LineCall = Call & { sessionId?: string };

function clock(from?: string, to?: string) {
  if (!from) return "00:00";
  const s = Math.max(0, Math.floor(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function useRingtone(on: boolean, armed: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!on || !armed) return;
    ctx.current ??= new AudioContext();
    const ac = ctx.current;
    let stopped = false;
    const ring = () => {
      if (stopped) return;
      const t = ac.currentTime;
      for (const [f, start] of [
        [880, 0],
        [660, 0.18],
        [880, 0.5],
        [660, 0.68],
      ] as const) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + start);
        g.gain.exponentialRampToValueAtTime(0.12, t + start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.16);
        o.connect(g).connect(ac.destination);
        o.start(t + start);
        o.stop(t + start + 0.18);
      }
    };
    ring();
    const id = setInterval(ring, 2200);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [on, armed]);
  return () => {
    ctx.current ??= new AudioContext();
    void ctx.current.resume();
  };
}

export function Receiver({ slot, insurer, name }: { slot: string; insurer: string; name: string }) {
  const [calls, setCalls] = useState<Record<string, LineCall>>({});
  const [firstName, setFirstName] = useState("your client");
  const [armed, setArmed] = useState(false);
  const [declined, setDeclined] = useState<string | null>(null);
  const [, tick] = useState(0);
  const live = useLiveCall();
  const scroller = useRef<HTMLDivElement>(null);
  const target = `slot:${slot}`;

  useEffect(() => {
    fetch("/api/calls")
      .then((r) => r.json())
      .then((d: { calls: LineCall[]; person: { firstName: string } }) => {
        setFirstName(d.person.firstName);
        setCalls(Object.fromEntries(d.calls.filter((c) => c.target === target).map((c) => [c.id, c])));
      })
      .catch(() => {});
    const source = new EventSource("/api/events");
    source.onmessage = (e) => {
      const ev = JSON.parse(e.data) as StoreEvent | { type: "hello" };
      if (ev.type === "call" && ev.call.target === target) setCalls((p) => ({ ...p, [ev.call.id]: ev.call as LineCall }));
    };
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      source.close();
      clearInterval(t);
    };
  }, [target]);

  const call = useMemo(() => Object.values(calls).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0], [calls]);
  const mine = live.callId && call?.id === live.callId;
  const inCall = mine && (live.status === "connecting" || live.status === "live");
  const ringing = !!call && call.status !== "ended" && !call.sessionId && !inCall && declined !== call.id;
  const unlock = useRingtone(ringing, armed);
  const turns = (call?.transcript ?? []).filter((t) => t.text.trim());

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, turns.at(-1)?.text]);

  const arm = async () => {
    unlock();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch {}
    setArmed(true);
  };

  const answer = () => {
    if (!call) return;
    unlock();
    void live.start(call.policyId, { callId: call.id });
  };

  const decline = async () => {
    if (!call) return;
    setDeclined(call.id);
    await fetch("/api/live/hangup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId: call.id }) }).catch(() => {});
  };

  const hangup = () => void live.hangup();

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pt-6 pb-8">
      <header className="flex items-center justify-between text-sm text-subtle">
        <span>
          Line {slot} · {insurer}
        </span>
        {name && <span>{name}</span>}
      </header>

      {!armed && !inCall ? (
        <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <span className="grid size-20 place-items-center rounded-full bg-white text-ink shadow-[0_0_0_1px_var(--color-line)]">
            <Phone size={28} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.025em]">You&apos;re the broker at {insurer}</h1>
            <p className="text-base leading-6 text-muted">Tap once so this phone can ring and use the microphone.</p>
          </div>
          <button type="button" onClick={arm} className="min-h-14 w-full rounded-2xl bg-ink text-base font-semibold text-white transition-transform duration-150 ease-out-strong active:scale-[0.98]">
            Get ready
          </button>
        </section>
      ) : inCall || (mine && live.status === "ending") ? (
        <section className="flex flex-1 flex-col gap-5 pt-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-[22px] leading-7 font-semibold">Lowball</span>
            <span className="text-sm text-subtle">
              AI assistant for {firstName} · <span className="num">{clock(call?.startedAt)}</span>
            </span>
            {call?.theirOffer !== undefined && (
              <span className="mt-3 rounded-full bg-white px-3 py-1 text-sm text-muted shadow-[inset_0_0_0_1px_var(--color-line)]">
                Your offer <span className="num font-semibold text-ink">{usd(call.theirOffer)}</span>
                {call.ask !== undefined && (
                  <>
                    {" "}
                    · they want <span className="num font-semibold text-accent">{usd(call.ask)}</span>
                  </>
                )}
              </span>
            )}
          </div>
          <div ref={scroller} className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {live.status === "connecting" && <p className="py-6 text-center text-subtle">Connecting…</p>}
            {turns.map((t) => (
              <div
                key={t.id}
                className={`rise max-w-[85%] rounded-[18px] px-4 py-2.5 text-[15px] leading-[22px] ${
                  t.speaker === "agent" ? "self-start rounded-bl-md bg-white shadow-[inset_0_0_0_1px_var(--color-line)]" : "self-end rounded-br-md bg-accent-soft text-ink-2"
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={hangup}
            aria-label="Hang up"
            className="mx-auto grid size-[72px] place-items-center rounded-full bg-[#e5484d] text-white transition-transform duration-150 ease-out-strong active:scale-95"
          >
            <Phone size={28} className="rotate-[135deg]" />
          </button>
        </section>
      ) : ringing ? (
        <section className="flex flex-1 flex-col items-center justify-between pt-16 text-center">
          <div className="flex flex-col items-center gap-5">
            <span className="relative grid size-28 place-items-center">
              <span className="live absolute inset-0 rounded-full bg-accent/15" />
              <span className="grid size-20 place-items-center rounded-full bg-accent text-[28px] font-semibold text-white">L</span>
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[34px] leading-10 font-semibold tracking-[-0.03em]">Lowball</h1>
              <p className="text-base leading-6 text-muted">AI assistant calling about {firstName}&apos;s insurance</p>
            </div>
          </div>
          <div className="flex w-full items-center justify-around pb-6">
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={decline} aria-label="Decline" className="grid size-[72px] place-items-center rounded-full bg-[#e5484d] text-white active:scale-95">
                <Phone size={28} className="rotate-[135deg]" />
              </button>
              <span className="text-sm text-muted">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button type="button" onClick={answer} aria-label="Answer" className="grid size-[72px] place-items-center rounded-full bg-[#2e9b57] text-white active:scale-95">
                <Phone size={28} />
              </button>
              <span className="text-sm text-muted">Answer</span>
            </div>
          </div>
          {live.error && <p className="text-sm text-[#b42318]">{live.error}</p>}
        </section>
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <span className="live size-2.5 rounded-full bg-money" />
          {call?.status === "ended" ? (
            <>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">Call ended</h1>
              <p className="text-base text-muted">
                {call.agreedMonthly !== undefined ? `Agreed at ${usd(call.agreedMonthly)}/mo · ` : ""}
                <span className="num">{clock(call.startedAt, call.endedAt)}</span>
              </p>
              <p className="pt-4 text-sm text-subtle">Waiting for the next call</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">Ready</h1>
              <p className="text-base text-muted">This phone will ring when Lowball calls {insurer}.</p>
              <p className="max-w-[300px] text-sm text-subtle">The agent runs on its own Fly.io Machine and speaks through GPT-Live.</p>
            </>
          )}
          {live.error && <p className="text-sm text-[#b42318]">{live.error}</p>}
        </section>
      )}
    </main>
  );
}
