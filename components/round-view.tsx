"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Call, Policy, StoreEvent } from "@/lib/types";
import { usd } from "@/lib/view";
import { ArrowRight, Back } from "./icons";

const offerOf = (c: Call) => c.agreedMonthly ?? c.theirOffer;

function elapsed(from: string, to?: string) {
  const s = Math.max(0, Math.floor(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function statusText(c: Call) {
  if (c.agreedMonthly !== undefined) return `Agreed at ${usd(c.agreedMonthly)}`;
  if (c.status === "dialing") return "Ringing…";
  if (c.status === "ended") return "Ended";
  return c.channel === "email" ? "Emailing" : "On the phone";
}

export function RoundView({ initial, selectedId, policy, fairMonthly }: { initial: Call[]; selectedId: string; policy: Policy; fairMonthly?: number }) {
  const [calls, setCalls] = useState<Record<string, Call>>(() => Object.fromEntries(initial.map((c) => [c.id, c])));
  const [selected, setSelected] = useState(selectedId);
  const [, tick] = useState(0);
  const roundId = initial[0]?.roundId;
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (e) => {
      const ev = JSON.parse(e.data) as StoreEvent | { type: "hello" };
      if (ev.type !== "call") return;
      const c = ev.call;
      if (roundId ? c.roundId !== roundId : c.id !== selectedId) return;
      setCalls((prev) => ({ ...prev, [c.id]: c }));
    };
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      source.close();
      clearInterval(t);
    };
  }, [roundId, selectedId]);

  const list = useMemo(() => Object.values(calls).sort((a, b) => a.id.localeCompare(b.id)), [calls]);
  const call = calls[selected] ?? list[0];
  const best = useMemo(() => {
    const offers = list.filter((c) => offerOf(c) !== undefined);
    return offers.length ? offers.reduce((a, b) => (offerOf(a)! <= offerOf(b)! ? a : b)) : undefined;
  }, [list]);
  const turns = call.transcript.filter((t) => t.text.trim());
  const lastAgent = [...turns].reverse().find((t) => t.speaker === "agent");

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, turns.at(-1)?.text]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col gap-8 px-5 pt-7 pb-10">
      <header className="flex items-center justify-between gap-3">
        <Link href={`/policy/${policy.id}`} className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink">
          <Back />
          {policy.insurer}
        </Link>
        <span className="text-sm text-subtle">
          {list.length > 1 ? `${list.length} agents · shared memory` : "1 agent"}
        </span>
      </header>

      {list.length > 1 && (
        <nav aria-label="Lines in this negotiation" className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-2">
          {list.map((c) => {
            const o = offerOf(c);
            const isBest = best?.id === c.id;
            const active = c.id === call.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelected(c.id)}
                aria-pressed={active}
                className={`flex min-h-[76px] flex-col items-start justify-between gap-1 rounded-2xl px-4 py-3 text-left transition-[box-shadow,background-color] duration-150 ease-out-strong ${
                  active ? "bg-white shadow-[0_0_0_1.5px_var(--color-accent)]" : "bg-white/60 shadow-[0_0_0_1px_var(--color-line)] hover:bg-white"
                }`}
              >
                <span className="flex w-full items-center gap-2">
                  {c.status !== "ended" && <span className={`size-1.5 rounded-full ${c.status === "live" ? "live bg-accent" : "bg-faint"}`} />}
                  <span className="truncate text-[15px] leading-5 font-semibold">{c.insurer}</span>
                  {c.role === "retention" && <span className="ml-auto text-xs text-subtle">current</span>}
                </span>
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="text-[13px] leading-[18px] text-subtle">{statusText(c)}</span>
                  {o !== undefined && (
                    <span className={`num text-lg leading-6 font-semibold ${c.agreedMonthly !== undefined ? "text-money" : isBest ? "text-accent" : ""}`}>{usd(o)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      <section className="flex flex-col items-center gap-3.5 text-center">
        <span className="inline-flex items-center gap-2 text-[15px] leading-[22px] text-muted">
          {call.status !== "ended" && <span className={`size-2 rounded-full ${call.status === "live" ? "live bg-accent" : "bg-faint"}`} />}
          {statusText(call)} · {call.counterpart} · <span className="num">{elapsed(call.startedAt, call.endedAt)}</span>
        </span>
        {call.agreedMonthly !== undefined ? (
          <div className="flex flex-col items-center gap-1">
            <span className="num text-[96px] leading-[96px] font-semibold tracking-[-0.05em] text-money">{usd(call.agreedMonthly)}</span>
            <span className="text-[15px] text-subtle">
              Down from {usd(policy.monthlyPremium)} · saves {usd((policy.monthlyPremium - call.agreedMonthly) * 12)}/yr
            </span>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <span className={`num text-[96px] leading-[96px] font-semibold tracking-[-0.05em] ${call.theirOffer !== undefined ? "text-[#b4b8be]" : "text-line"}`}>
                {call.theirOffer !== undefined ? usd(call.theirOffer) : "—"}
              </span>
              <ArrowRight size={32} className="text-[#c9cdd2]" />
              <span className="num text-[96px] leading-[96px] font-semibold tracking-[-0.05em] text-accent">{usd(call.ask ?? fairMonthly ?? policy.monthlyPremium)}</span>
            </div>
            <span className="text-[15px] leading-[22px] text-subtle">Their offer → what Lowball is asking for</span>
          </>
        )}
      </section>

      <section aria-label="Transcript" ref={scroller} className="flex max-h-[46dvh] flex-col gap-2.5 overflow-y-auto scroll-smooth px-0.5 py-1">
        {turns.length === 0 && <p className="py-6 text-center text-[15px] text-subtle">{call.status === "dialing" ? "Ringing…" : "Waiting for the first words…"}</p>}
        {turns.map((t) =>
          t.speaker === "counterpart" ? (
            <div key={t.id} className="rise max-w-[80%] self-start rounded-[18px_18px_18px_6px] bg-white px-4 py-3 text-base leading-6 shadow-[inset_0_0_0_1px_var(--color-line)]">
              {t.text}
            </div>
          ) : (
            <div
              key={t.id}
              className={`rise max-w-[80%] self-end rounded-[18px_18px_6px_18px] px-[18px] py-3.5 text-left ${
                t === lastAgent ? "bg-accent text-[17px] leading-[26px] text-white" : "bg-accent-soft text-base leading-6 text-ink-2"
              }`}
            >
              {t.text}
              {!t.final && <span className="caret ml-[3px] inline-block h-[18px] w-0.5 bg-current align-[-3px]" />}
            </div>
          ),
        )}
      </section>

      {call.citing.length > 0 && (
        <div className="flex flex-wrap justify-end gap-1.5">
          {call.citing.map((c) => (
            <span key={c} className="rise rounded-full bg-white px-2.5 py-1 text-[13px] leading-[18px] text-muted shadow-[inset_0_0_0_1px_var(--color-line)]">
              {c}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
