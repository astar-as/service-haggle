import Link from "next/link";
import { Ask } from "@/components/ask";
import { Chevron } from "@/components/icons";
import { LiveRefresh } from "@/components/live-refresh";
import { NegotiateAll } from "@/components/negotiate-all";
import { store } from "@/lib/store";
import type { Call } from "@/lib/types";
import { buildRows, kindLabel, subtitle, usd, type Row } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [person, policies, stances, calls] = await Promise.all([store.person(), store.policies(), store.stances(), store.calls()]);
  const live = calls.filter((c) => c.status !== "ended");
  const { needs, fair, pays, tooMuch } = buildRows(policies, stances, live);
  const initials = person.name
    .split(" ")
    .map((s) => s[0])
    .join("");

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-10 px-5 pt-7 pb-14">
      <LiveRefresh />
      <header className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[19px] leading-6 font-bold tracking-[-0.02em]">
          <span className="size-2.5 rounded-[3px] bg-accent" />
          lowball
        </span>
        <span
          aria-label={person.name}
          className="grid size-8 place-items-center rounded-full bg-white text-xs font-semibold text-muted shadow-[inset_0_0_0_1px_var(--color-line)]"
        >
          {initials}
        </span>
      </header>

      <h1 className="mt-4 text-[44px] leading-[50px] font-semibold tracking-[-0.035em] text-balance">
        {person.firstName} pays <span className="num">{usd(pays)}</span> a month.
        <br />
        {tooMuch > 0 ? (
          <span className="text-accent">
            <span className="num">{usd(tooMuch)}</span> of that is too much.
          </span>
        ) : (
          <span className="text-money">All of it is fair.</span>
        )}
      </h1>

      {live.length > 0 && <LiveAgents calls={live} policies={policies} />}

      {needs.length > 0 && (
        <Group title="Needs negotiating" aside={<span className="num font-semibold text-accent">−{usd(tooMuch)}/mo</span>}>
          {needs.map((r) => (
            <PolicyRow key={r.policy.id} row={r} big />
          ))}
        </Group>
      )}

      {fair.length > 0 && (
        <Group title="Fair" aside={<span className="text-sm text-subtle">Watching</span>}>
          {fair.map((r) => (
            <PolicyRow key={r.policy.id} row={r} />
          ))}
        </Group>
      )}

      <div className="flex flex-col gap-3">
        <Ask placeholder="Ask Lowball anything…" />
        <NegotiateAll />
      </div>
    </main>
  );
}

function LiveAgents({ calls, policies }: { calls: Call[]; policies: { id: string; insurer: string }[] }) {
  return (
    <section aria-label="Live agents" className="flex flex-col gap-2">
      {calls.map((c) => {
        const insurer = policies.find((p) => p.id === c.policyId)?.insurer ?? c.counterpart;
        const last = [...c.transcript].reverse().find((t) => t.text.trim());
        return (
          <Link
            key={c.id}
            href={`/call/${c.id}`}
            className="rise flex min-h-14 items-center gap-3 rounded-2xl bg-accent px-5 py-3 text-white transition-transform duration-150 ease-out-strong active:scale-[0.99]"
          >
            <span className="live size-2 flex-none rounded-full bg-white" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-base leading-[22px] font-medium">
                {c.status === "dialing" ? "Calling" : c.channel === "email" ? "Emailing" : "On the phone with"} {insurer}
              </span>
              {last && <span className="truncate text-sm leading-5 text-white/75">“{last.text}”</span>}
            </span>
            {c.theirOffer !== undefined && <span className="num text-[15px] text-white/85">{usd(c.theirOffer)}</span>}
            <Chevron />
          </Link>
        );
      })}
    </section>
  );
}

function Group({ title, aside, children }: { title: string; aside: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-[15px] leading-[22px] font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">{children}</div>
    </section>
  );
}

function PolicyRow({ row, big }: { row: Row; big?: boolean }) {
  const href = row.live && row.callId ? `/call/${row.callId}` : `/policy/${row.policy.id}`;
  const sub = subtitle(row);
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 border-t border-hair px-5 transition-colors duration-150 first:border-t-0 hover:bg-[#fafbfb]"
      style={{ minHeight: big ? 76 : 64 }}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={big ? "text-[17px] leading-6 font-semibold" : "text-base leading-[22px] font-semibold"}>{row.policy.insurer}</span>
        <span className="text-sm leading-5 text-subtle">
          {kindLabel(row.policy.kind)}
          {sub && " · "}
          {sub && <span className={row.live ? "font-medium text-accent" : undefined}>{sub}</span>}
        </span>
      </span>
      <span className="flex flex-col items-end gap-0.5">
        <span className={`num font-semibold ${big ? "text-[17px] leading-6" : "text-base leading-[22px]"}`}>{usd(row.policy.monthlyPremium)}</span>
        {row.gap > 0 && <span className="num text-sm leading-5 font-medium text-accent">−{usd(row.gap)}</span>}
      </span>
      <Chevron className="text-faint transition-transform duration-150 ease-out-strong group-hover:translate-x-0.5 group-hover:text-ink" />
    </Link>
  );
}
