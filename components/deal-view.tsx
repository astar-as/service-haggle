"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Deal, DealStatus } from "@/lib/types";
import { kindLabel, usd } from "@/lib/view";
import { Back } from "./icons";

const card = "overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]";
const primary =
  "min-h-12 rounded-xl bg-accent px-5 text-[15px] font-semibold text-white transition-transform duration-150 ease-out-strong active:scale-[0.99] disabled:opacity-50";

const TITLE: Record<DealStatus, (d: Deal) => string> = {
  confirming: (d) => `Getting ${d.insurer} to confirm in writing`,
  awaiting_release: (d) => `${d.insurer} needs ${d.requested.length} sealed details`,
  releasing: () => "Sending your details",
  checking_contract: () => "Checking the contract",
  awaiting_signature: () => "Ready for your signature",
  signing: () => "Sending your signature",
  bound: () => "Signed and bound.",
  declined: () => "Stopped. Nothing was shared.",
  failed: () => "Something went wrong",
};

const STEPS: { label: string; done: DealStatus[] }[] = [
  {
    label: "Confirm",
    done: [
      "awaiting_release",
      "releasing",
      "checking_contract",
      "awaiting_signature",
      "signing",
      "bound",
    ],
  },
  { label: "Release", done: ["checking_contract", "awaiting_signature", "signing", "bound"] },
  { label: "Contract", done: ["awaiting_signature", "signing", "bound"] },
  { label: "Sign", done: ["bound"] },
  { label: "Bound", done: ["bound"] },
];

const WORKING: DealStatus[] = ["confirming", "releasing", "checking_contract", "signing"];

export function DealView({
  initial,
  personName,
  firstName,
  product,
  kind,
}: {
  initial: Deal;
  personName: string;
  firstName: string;
  product: string;
  kind: string;
}) {
  const [deal, setDeal] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (deal.status === "bound" || deal.status === "declined" || deal.status === "failed") return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/deals/${deal.id}`).catch(() => null);
      const body = res ? ((await res.json()) as { deal?: Deal }) : {};
      if (body.deal) setDeal(body.deal);
    }, 1500);
    return () => clearInterval(t);
  }, [deal.id, deal.status]);

  async function act(action: "release" | "decline" | "sign") {
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/deals/${deal.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, name }),
    });
    const body = (await res.json()) as { deal?: Deal; error?: string };
    if (body.deal)
      setDeal({
        ...body.deal,
        status:
          action === "release" ? "releasing" : action === "sign" ? "signing" : body.deal.status,
      });
    if (body.error) setError(body.error);
    setBusy(false);
  }

  const saved = deal.previousMonthly - deal.monthly;
  const corrected = deal.mails.some((m) => m.labels.includes("correction"));

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-5 pt-7 pb-14">
      <Link
        href={`/negotiation/${deal.policyId}`}
        className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium text-muted hover:text-ink"
      >
        <Back />
        Negotiation
      </Link>

      <section className="flex flex-col gap-2">
        <span className="text-sm leading-5 text-subtle">
          {kindLabel(kind)} · {product} · deal {deal.ref}
          {deal.autopilot && (
            <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-semibold text-accent">
              Autopilot
            </span>
          )}
        </span>
        <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em] text-balance">
          {WORKING.includes(deal.status) && (
            <span className="live mr-3 inline-block size-2.5 rounded-full bg-accent align-middle" />
          )}
          {TITLE[deal.status](deal)}
        </h1>
        <p className="num text-lg leading-7 text-subtle">
          <span className="line-through decoration-faint">{usd(deal.previousMonthly)}</span> →{" "}
          <span className="font-semibold text-money">{usd(deal.monthly)}/mo</span> with{" "}
          {deal.insurer} · saves {usd(saved * 12)} a year
        </p>
      </section>

      <ol className="grid grid-cols-5 gap-1.5" aria-label="Progress">
        {STEPS.map((s) => {
          const done = s.done.includes(deal.status);
          return (
            <li key={s.label} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${done ? "bg-money" : "bg-hair"}`} />
              <span className={`text-[13px] ${done ? "font-semibold text-ink" : "text-subtle"}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {deal.status === "awaiting_release" && (
        <section className={card} aria-labelledby="release">
          <div className="flex flex-col gap-1 px-5 pt-5 pb-3">
            <h2 id="release" className="text-[17px] leading-6 font-semibold">
              Release these to {deal.insurer}?
            </h2>
            <p className="text-sm leading-5 text-subtle">
              They're sealed: no AI model has seen them. I fill them in at the mail layer, and the
              email waits as a draft in AgentMail until you approve it.
            </p>
          </div>
          {deal.requested.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-4 border-t border-hair px-5 py-3.5"
            >
              <span className="text-base">{r.label}</span>
              <span className="num font-semibold tracking-wide">{r.masked}</span>
            </div>
          ))}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-hair px-5 py-3.5 text-sm">
            <dt className="text-subtle">To</dt>
            <dd className="num">{deal.desk}</dd>
            <dt className="text-subtle">Why</dt>
            <dd>Binding the policy at {usd(deal.monthly)}/mo</dd>
            <dt className="text-subtle">How</dt>
            <dd>Draft in {deal.inbox}, labelled sensitive</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-4">
            <button className={primary} disabled={busy} onClick={() => act("release")}>
              Release and send
            </button>
            <button
              className="min-h-12 rounded-xl px-3 text-[15px] font-medium text-muted hover:text-ink"
              disabled={busy}
              onClick={() => act("decline")}
            >
              Don&apos;t send
            </button>
          </div>
        </section>
      )}

      {deal.contract &&
        (deal.status === "awaiting_signature" ||
          deal.status === "signing" ||
          deal.status === "bound") && (
          <section className={card} aria-labelledby="contract">
            <div className="flex flex-col gap-1 px-5 pt-5 pb-3">
              <h2 id="contract" className="text-[17px] leading-6 font-semibold">
                Contract checked against the deal
              </h2>
              <a
                href={`/api/deals/${deal.id}/pdf?doc=contract`}
                target="_blank"
                rel="noreferrer"
                className="num text-sm leading-5 text-subtle underline-offset-2 hover:text-ink hover:underline"
              >
                📎 {deal.contract.filename} · SHA-256 {deal.contract.sha256.slice(0, 12)}…
              </a>
            </div>
            {deal.contract.checks.map((c) => (
              <div
                key={c.label}
                className="flex items-baseline justify-between gap-4 border-t border-hair px-5 py-3"
              >
                <span className="text-base">{c.label}</span>
                <span className={`num font-semibold ${c.ok ? "text-money" : "text-accent"}`}>
                  {c.ok ? "✓ " : "✗ "}
                  {c.found}
                </span>
              </div>
            ))}
            {corrected && (
              <p className="border-t border-hair bg-accent-soft px-5 py-3 text-sm leading-5 text-ink-2">
                The first version had the wrong collision deductible. I asked {deal.insurer} for a
                corrected contract before showing it to you.
              </p>
            )}
            {deal.status === "awaiting_signature" && (
              <form
                className="flex flex-col gap-3 border-t border-hair px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  act("sign");
                }}
              >
                <label htmlFor="sign-name" className="text-sm text-subtle">
                  Type your full name to sign
                </label>
                <input
                  id="sign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={personName}
                  className="min-h-12 rounded-xl px-4 text-lg italic shadow-[inset_0_0_0_1px_var(--color-line)] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <label className="flex items-start gap-2.5 text-sm leading-5">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  I&apos;ve read the contract and I want to sign it. My assistant prepared it but
                  can&apos;t sign or pay for me.
                </label>
                <button
                  className={`${primary} self-start`}
                  disabled={
                    busy || !consent || name.trim().toLowerCase() !== personName.toLowerCase()
                  }
                >
                  Sign as {firstName}
                </button>
              </form>
            )}
          </section>
        )}

      {deal.status === "bound" && deal.receipt && (
        <section className={`${card} px-5 py-5`} aria-label="Receipt">
          <p className="text-[17px] leading-6 font-semibold">
            Policy {deal.receipt.policyNumber ?? "bound"} · receipt {deal.receipt.id}
          </p>
          <p className="mt-1 text-sm leading-5 text-subtle">
            Signed by {deal.signature?.name}
            {deal.signature?.mode === "autopilot"
              ? " under her standing authorization (autopilot)"
              : ""}{" "}
            · emailed to {deal.insurer} · receipt SHA-256 {deal.receipt.sha256.slice(0, 12)}…
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/api/deals/${deal.id}/pdf?doc=receipt`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center rounded-lg bg-accent px-3.5 text-[14px] font-semibold text-white"
            >
              Open signed receipt (PDF)
            </a>
            {deal.contract && (
              <a
                href={`/api/deals/${deal.id}/pdf?doc=contract`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center rounded-lg px-3.5 text-[14px] font-medium text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]"
              >
                Open contract
              </a>
            )}
          </div>
        </section>
      )}

      {(deal.status === "failed" || deal.status === "declined") && deal.note && (
        <p className={`${card} px-5 py-4 text-base text-ink-2`}>{deal.note}</p>
      )}
      {error && <p className="px-1 text-sm text-accent">{error}</p>}

      <section aria-labelledby="thread" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="thread" className="text-[15px] leading-[22px] font-semibold">
            Email thread
          </h2>
          <span className="text-[13px] text-subtle">AgentMail · {deal.mails.length} messages</span>
        </div>
        <div className={card}>
          {deal.mails.length === 0 && (
            <p className="px-5 py-4 text-base text-subtle">Writing to {deal.desk}…</p>
          )}
          {deal.mails.map((m, i) => (
            <div
              key={i}
              className="rise flex flex-col gap-1 border-t border-hair px-5 py-3.5 first:border-t-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="num text-[13px] text-subtle">
                  {m.direction === "in" ? "← " : m.direction === "draft" ? "✎ draft · " : "→ "}
                  {m.direction === "in" ? m.from : m.to}
                </span>
                <span className="num text-[13px] text-faint">
                  {new Date(m.at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <span className="text-base leading-[22px]">{m.summary}</span>
              <span className="flex flex-wrap gap-1.5">
                {m.labels.map((l) => (
                  <span
                    key={l}
                    className={`rounded-full px-2 py-0.5 text-[12px] ${l === "sensitive" ? "bg-accent-soft text-accent" : "bg-canvas text-subtle"}`}
                  >
                    {l}
                  </span>
                ))}
                {m.attachment && (
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[12px] text-ink-2">
                    📎 {m.attachment}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
