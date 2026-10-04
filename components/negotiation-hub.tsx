"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PriceBoard } from "@/lib/pricing";
import type { Call, Policy, Stance } from "@/lib/types";
import { kindLabel, usd } from "@/lib/view";
import { CloseDeal } from "./close-deal";
import { MustMatch } from "./coverage";
import { Back, Mail, Phone } from "./icons";
import { ShopButton } from "./shop-button";
import { StopButton } from "./stop-button";

const offerOf = (c: Call) => c.agreedMonthly ?? c.theirOffer;

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function elapsed(from: string, to?: string) {
  const s = Math.max(
    0,
    Math.floor(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 1000),
  );
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function lineStatus(c: Call) {
  if (c.agreedMonthly !== undefined) return `Agreed at ${usd(c.agreedMonthly)}`;
  if (c.channel === "email") {
    if (c.status === "ended") return "Thread closed";
    const replies = c.transcript.filter((t) => t.speaker === "counterpart").length;
    return replies
      ? `${replies} ${replies === 1 ? "reply" : "replies"}`
      : c.status === "dialing"
        ? "Writing…"
        : "Waiting for reply";
  }
  if (c.status === "dialing") return c.target?.startsWith("slot:") ? "Ringing…" : "Dialing…";
  if (c.status === "ended") return `Call ended · ${elapsed(c.startedAt, c.endedAt)}`;
  return `On the phone · ${elapsed(c.startedAt)}`;
}

const SOURCE: Record<string, string> = {
  published: "Published price",
  campaign: "Campaign",
  network: "Lowball network",
  quote: "Quote",
  retention: "Retention offer",
};

interface Event {
  id: string;
  at: string;
  text: string;
  tone?: "accent" | "money";
}

function buildTimeline(lines: Call[]): Event[] {
  const out: Event[] = [];
  for (const c of lines) {
    out.push({
      id: `${c.id}-start`,
      at: c.startedAt,
      text:
        c.channel === "email"
          ? `Emailed ${c.insurer} for a quote`
          : c.role === "retention"
            ? `Called ${c.insurer} to renegotiate`
            : `Called ${c.insurer} for a quote`,
    });
    let last: number | undefined;
    for (const t of c.transcript) {
      const m = t.speaker === "counterpart" ? t.text.match(/\$\s?(\d{2,4})/) : null;
      if (m && Number(m[1]) !== last) {
        last = Number(m[1]);
        out.push({
          id: `${t.id}-offer`,
          at: t.at,
          text: `${c.insurer} offered ${usd(last)}${c.channel === "email" ? " by email" : ""}`,
        });
      }
    }
    for (const label of c.citing.filter((l) => / · live call| · email/.test(l))) {
      out.push({
        id: `${c.id}-${label}`,
        at: c.transcript.at(-1)?.at ?? c.startedAt,
        text: `Used ${label.split(" · ")[0]} as leverage with ${c.insurer}`,
        tone: "accent",
      });
    }
    if (c.agreedMonthly !== undefined)
      out.push({
        id: `${c.id}-agreed`,
        at: c.endedAt ?? c.transcript.at(-1)?.at ?? c.startedAt,
        text: `${c.insurer} agreed to ${usd(c.agreedMonthly)}`,
        tone: "money",
      });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function NegotiationHub({
  policy,
  stance,
  lines,
  earlier,
  board,
  firstName,
  initialLine,
}: {
  policy: Policy;
  stance?: Stance;
  lines: Call[];
  earlier: Call[];
  board?: PriceBoard;
  firstName: string;
  initialLine?: string;
}) {
  const [selected, setSelected] = useState(
    initialLine ?? lines.find((c) => c.status !== "ended")?.id ?? lines[0]?.id,
  );
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const target = stance?.fairMonthly ?? policy.monthlyPremium;
  const best = useMemo(() => {
    const offers = lines.filter((c) => offerOf(c) !== undefined);
    return offers.length
      ? offers.reduce((a, b) => (offerOf(a)! <= offerOf(b)! ? a : b))
      : undefined;
  }, [lines]);
  const bestPrice = best ? offerOf(best)! : undefined;
  const agreed = lines.find((c) => c.agreedMonthly !== undefined);
  const active = lines.some((c) => c.status !== "ended");
  const progress =
    bestPrice !== undefined && policy.monthlyPremium > target
      ? Math.min(
          1,
          Math.max(0, (policy.monthlyPremium - bestPrice) / (policy.monthlyPremium - target)),
        )
      : 0;
  const line = lines.find((c) => c.id === selected);
  const turns = (line?.transcript ?? []).filter((t) => t.text.trim());
  const timeline = useMemo(() => buildTimeline(lines), [lines]);

  return (
    <main className="mx-auto flex max-w-[760px] flex-col gap-8 px-5 pt-7 pb-14">
      <header className="flex items-center justify-between gap-3">
        <Link
          href={`/policy/${policy.id}`}
          className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-muted hover:text-ink"
        >
          <Back />
          {policy.insurer}
        </Link>
        {lines.length > 0 && (
          <span className="inline-flex items-center gap-2 text-sm text-subtle">
            {active && <span className="live size-1.5 rounded-full bg-accent" />}
            {lines.length} {lines.length === 1 ? "agent" : "agents"} · shared memory
            {active && <StopButton policyId={policy.id} />}
          </span>
        )}
      </header>

      <section className="flex flex-col gap-1">
        <span className="text-sm leading-5 text-subtle">
          {kindLabel(policy.kind)} · {policy.product}
        </span>
        <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
          {agreed
            ? "Done."
            : active
              ? "Negotiating"
              : lines.length
                ? "Negotiation paused"
                : "Ready to negotiate"}
        </h1>
      </section>

      <section
        aria-label="Price"
        className="flex flex-col gap-5 rounded-[20px] bg-white p-6 shadow-[0_0_0_1px_var(--color-line)]"
      >
        <div className="grid grid-cols-3 gap-4">
          <Figure
            label="Paying now"
            value={usd(policy.monthlyPremium)}
            muted={bestPrice !== undefined}
          />
          <Figure
            label={agreed ? "Agreed" : "Best so far"}
            value={bestPrice !== undefined ? usd(bestPrice) : "—"}
            tone={agreed ? "money" : "accent"}
            note={best ? best.insurer : undefined}
          />
          <Figure label={`${firstName}'s target`} value={usd(target)} note="fair price" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-2 overflow-hidden rounded-full bg-hair">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out-strong ${agreed ? "bg-money" : "bg-accent"}`}
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[13px] text-subtle">
            <span className="num">{usd(policy.monthlyPremium)}</span>
            <span className="num">
              {bestPrice !== undefined && bestPrice < policy.monthlyPremium
                ? `saves ${usd((policy.monthlyPremium - bestPrice) * 12)}/yr`
                : ""}
            </span>
            <span className="num">{usd(target)}</span>
          </div>
        </div>
      </section>

      {agreed && (
        <CloseDeal callId={agreed.id} monthly={agreed.agreedMonthly!} insurer={agreed.insurer} />
      )}

      {lines.length === 0 && stance && stance.verdict !== "fair" && (
        <ShopButton policyId={policy.id} insurer={policy.insurer} />
      )}

      {policy.coverage && <MustMatch coverage={policy.coverage} />}

      {lines.length > 0 && (
        <section aria-label="Lines" className="flex flex-col gap-3">
          <h2 className="px-1 text-[15px] leading-[22px] font-semibold">Lines</h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-2">
            {lines.map((c) => {
              const o = offerOf(c);
              const on = c.id === selected;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  aria-pressed={on}
                  className={`flex min-h-[84px] flex-col justify-between gap-2 rounded-2xl px-4 py-3 text-left transition-[box-shadow,background-color] duration-150 ease-out-strong ${
                    on
                      ? "bg-white shadow-[0_0_0_1.5px_var(--color-accent)]"
                      : "bg-white/60 shadow-[0_0_0_1px_var(--color-line)] hover:bg-white"
                  }`}
                >
                  <span className="flex w-full items-center gap-2">
                    {c.channel === "email" ? (
                      <Mail size={15} className="text-subtle" />
                    ) : (
                      <Phone size={15} className="text-subtle" />
                    )}
                    <span className="truncate text-[15px] leading-5 font-semibold">
                      {c.insurer}
                    </span>
                    {c.role === "retention" && (
                      <span className="ml-auto text-xs text-subtle">current</span>
                    )}
                  </span>
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[13px] leading-[18px] text-subtle">
                      {c.status === "live" && (
                        <span className="live size-1.5 rounded-full bg-accent" />
                      )}
                      {lineStatus(c)}
                    </span>
                    {o !== undefined && (
                      <span
                        className={`num text-lg leading-6 font-semibold ${c.agreedMonthly !== undefined ? "text-money" : best?.id === c.id ? "text-accent" : ""}`}
                      >
                        {usd(o)}
                      </span>
                    )}
                  </span>
                  {c.machineId && (
                    <span
                      className="num text-[11px] leading-4 text-faint"
                      title={`Fly Machine ${c.machineId}`}
                    >
                      Fly Machine {c.machineId.slice(0, 6)}…{c.machineId.slice(-2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {line && (
        <section
          aria-label={`${line.insurer} ${line.channel === "email" ? "email thread" : "call"}`}
          className="flex flex-col gap-2.5"
        >
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] leading-[22px] font-semibold">
              {line.channel === "email" ? "Email thread" : "Call"} with {line.counterpart}
            </h2>
            {line.target && !line.target.startsWith("slot:") && (
              <span className="text-[13px] text-subtle">{line.target.replace("mailto:", "")}</span>
            )}
          </div>
          {turns.length === 0 && (
            <p className="py-4 text-center text-[15px] text-subtle">{lineStatus(line)}</p>
          )}
          {turns.map((t) =>
            t.speaker === "counterpart" ? (
              <div
                key={t.id}
                className="rise max-w-[82%] self-start rounded-[18px_18px_18px_6px] bg-white px-4 py-3 text-base leading-6 whitespace-pre-line shadow-[inset_0_0_0_1px_var(--color-line)]"
              >
                {t.text}
              </div>
            ) : (
              <div
                key={t.id}
                className="rise max-w-[82%] self-end rounded-[18px_18px_6px_18px] bg-accent-soft px-4 py-3 text-base leading-6 whitespace-pre-line text-ink-2"
              >
                {t.text}
                {!t.final && (
                  <span className="caret ml-[3px] inline-block h-[18px] w-0.5 bg-current align-[-3px]" />
                )}
              </div>
            ),
          )}
          {line.citing.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5 pt-1">
              {line.citing.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white px-2.5 py-1 text-[13px] leading-[18px] text-muted shadow-[inset_0_0_0_1px_var(--color-line)]"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section aria-label="Timeline" className="flex flex-col gap-3">
          <h2 className="px-1 text-[15px] leading-[22px] font-semibold">Everything so far</h2>
          <ol className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
            {timeline.map((e) => (
              <li
                key={e.id}
                className="rise grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-4 border-t border-hair px-5 py-3.5 first:border-t-0"
              >
                <span className="num text-sm text-subtle">{time(e.at)}</span>
                <span
                  className={`text-[15px] leading-[22px] ${e.tone === "money" ? "font-medium text-money" : e.tone === "accent" ? "text-accent" : ""}`}
                >
                  {e.text}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {board && board.candidates.length > 0 && (
        <section aria-label="Prices found" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <h2 className="text-[15px] leading-[22px] font-semibold">Prices found</h2>
            {board.bestObtainable && (
              <span className="text-sm text-subtle">
                Cheapest you can sign:{" "}
                <span className="num font-semibold text-ink">
                  {usd(board.bestObtainable.monthly)}
                </span>
              </span>
            )}
          </div>
          <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
            {board.candidates.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 border-t border-hair px-5 py-3.5 first:border-t-0"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[15px] leading-[22px] font-medium">{p.insurer}</span>
                  <span className="truncate text-[13px] leading-[18px] text-subtle">
                    {SOURCE[p.source] ?? p.source}
                    {p.basis ? ` · ${p.basis}` : ""}
                  </span>
                </span>
                {p.url ? (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="num text-base font-semibold hover:text-accent"
                  >
                    {usd(p.monthly)}
                  </a>
                ) : (
                  <span className="num text-base font-semibold">{usd(p.monthly)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {earlier.length > 0 && (
        <p className="px-1 text-sm text-subtle">
          {earlier.length} earlier {earlier.length === 1 ? "line" : "lines"} from previous rounds.
        </p>
      )}
    </main>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
  muted,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "accent" | "money";
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] leading-[18px] text-subtle">{label}</span>
      <span
        className={`num text-[32px] leading-9 font-semibold tracking-[-0.035em] ${tone === "money" ? "text-money" : tone === "accent" ? "text-accent" : muted ? "text-[#b4b8be]" : ""}`}
      >
        {value}
      </span>
      {note && <span className="truncate text-[13px] leading-[18px] text-subtle">{note}</span>}
    </div>
  );
}
