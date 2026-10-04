import Link from "next/link";
import { notFound } from "next/navigation";
import { Ask } from "@/components/ask";
import { CoverageTable } from "@/components/coverage";
import { Back, Chevron } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { ShopButton } from "@/components/shop-button";
import { store } from "@/lib/store";
import { kindLabel, shortDate, signalLabel, usd } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [policy, stance, signals, calls] = await Promise.all([store.policy(id), store.stance(id), store.signals(id), store.calls()]);
  if (!policy) notFound();
  const facts = policy.facts.filter((f) => f.disclosure !== "hidden");
  const rounds = calls.filter((c) => c.policyId === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const live = rounds.find((c) => c.status !== "ended");
  const canShop = stance && stance.verdict !== "fair" && stance.verdict !== "won";

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-9 px-5 pt-7 pb-14">
      <LiveRefresh />
      <Link href="/" className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium text-muted hover:text-ink">
        <Back />
        All policies
      </Link>

      <section className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-1">
          <span className="text-sm leading-5 text-subtle">
            {kindLabel(policy.kind)} · {policy.product}
          </span>
          <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">{policy.insurer}</h1>
        </div>
        <div className="flex flex-wrap items-baseline gap-4">
          <span className="num text-[64px] leading-[64px] font-semibold tracking-[-0.045em]">{usd(policy.monthlyPremium)}</span>
          {stance && (
            <span className="num text-lg leading-6 text-subtle">
              /mo · fair is about <span className="font-semibold text-accent">{usd(stance.fairMonthly)}</span>
            </span>
          )}
        </div>
        {stance && (
          <p className="mt-1.5 text-[22px] leading-[31px] tracking-[-0.01em] text-pretty text-ink-2">
            {stance.headline} {stance.detail}
          </p>
        )}
        {live ? (
          <Link
            href={`/negotiation/${policy.id}`}
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-accent px-5 text-white transition-transform duration-150 ease-out-strong active:scale-[0.99]"
          >
            <span className="live size-2 rounded-full bg-white" />
            <span className="flex-1 text-base font-medium">Negotiating now</span>
            <Chevron />
          </Link>
        ) : (
          canShop && <ShopButton policyId={policy.id} insurer={policy.insurer} />
        )}
      </section>

      {policy.coverage && <CoverageTable coverage={policy.coverage} />}

      {signals.length > 0 && (
        <section aria-labelledby="noticed" className="flex flex-col gap-3">
          <h2 id="noticed" className="px-1 text-[15px] leading-[22px] font-semibold">
            What I&apos;ve noticed
          </h2>
          <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
            {signals.slice(0, 6).map((s) => (
              <div key={s.id} className="rise grid grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-4 border-t border-hair px-5 py-[18px] first:border-t-0">
                <span className="num text-sm leading-[22px] text-subtle">{shortDate(s.at)}</span>
                <span className="text-base leading-[23px]">{s.title}</span>
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-[13px] leading-[22px] text-subtle underline-offset-2 hover:text-ink hover:underline">
                    {signalLabel(s)}
                  </a>
                ) : (
                  <span className="text-[13px] leading-[22px] text-subtle">{signalLabel(s)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {facts.length > 0 && (
        <section aria-labelledby="policy" className="flex flex-col gap-3">
          <h2 id="policy" className="px-1 text-[15px] leading-[22px] font-semibold">
            Policy
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
            <Fact label="Renews" value={shortDate(policy.renewsOn)} />
            {facts.map((f) => (
              <Fact key={f.label} label={f.label} value={f.value} />
            ))}
            <Fact label="Member since" value={String(policy.memberSince)} />
          </div>
        </section>
      )}

      {rounds.length > 0 && (
        <section aria-labelledby="calls" className="flex flex-col gap-3">
          <h2 id="calls" className="px-1 text-[15px] leading-[22px] font-semibold">
            Negotiations
          </h2>
          <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
            {rounds.map((c) => (
              <Link key={c.id} href={`/negotiation/${policy.id}?line=${c.id}`} className="group flex min-h-16 items-center gap-4 border-t border-hair px-5 first:border-t-0 hover:bg-[#fafbfb]">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base leading-[22px] font-semibold">{c.insurer}</span>
                  <span className="text-sm leading-5 text-subtle">
                    {c.channel === "email" ? "Email" : "Call"} · {c.status === "ended" ? shortDate(c.startedAt) : "live"}
                  </span>
                </span>
                {(c.agreedMonthly ?? c.theirOffer) !== undefined && (
                  <span className={`num text-base font-semibold ${c.agreedMonthly !== undefined ? "text-money" : ""}`}>{usd((c.agreedMonthly ?? c.theirOffer)!)}</span>
                )}
                <Chevron className="text-faint group-hover:text-ink" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <Ask placeholder={`Ask about ${policy.insurer}…`} policyId={policy.id} />
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-4 shadow-[inset_0_0_0_0.5px_var(--color-hair)]">
      <span className="text-[13px] leading-[18px] text-subtle">{label}</span>
      <span className="num text-base leading-[22px] font-semibold">{value}</span>
    </div>
  );
}
