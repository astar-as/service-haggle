import Link from "next/link";
import { Back } from "@/components/icons";
import { describeModels } from "@/lib/models";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

interface Row {
  name: string;
  role: string;
  live: string;
  on: boolean;
  off?: string;
  href?: string;
  where?: string;
}

// Live view of the agent machines straight from the Fly Machines API.
async function flyMachines() {
  const app = process.env.FLY_APP_NAME;
  const token = process.env.FLY_API_TOKEN;
  if (!app || !token) return null;
  try {
    const res = await fetch(`https://api.machines.dev/v1/apps/${app}/machines`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ms = (await res.json()) as { state: string; region: string }[];
    return {
      app,
      running: ms.filter((m) => m.state === "started").length,
      warm: ms.filter((m) => m.state === "stopped" || m.state === "suspended").length,
      regions: [...new Set(ms.map((m) => m.region))],
    };
  } catch {
    return null;
  }
}

export default async function StackPage() {
  const [deals, calls, prices, signals, policies, stances] = await Promise.all([
    store.deals(),
    store.calls(),
    store.prices(),
    store.signals(),
    store.policies(),
    store.stances(),
  ]);
  const models = describeModels();
  const fly = await flyMachines();
  const emails = deals.reduce(
    (a, d) => a + d.mails.filter((m) => m.direction !== "draft").length,
    0,
  );
  const emailLines = calls.filter((c) => c.channel === "email").length;
  const published = prices.filter((p) => p.source === "published").length;
  const campaigns = prices.filter((p) => p.source === "campaign").length;
  const hosts = new Set(prices.flatMap((p) => (p.url ? [new URL(p.url).hostname] : []))).size;
  const exaSignals = signals.filter((s) => s.source === "exa").length;
  const machines = new Set(calls.flatMap((c) => (c.machineId ? [c.machineId] : []))).size;
  const probes = signals.filter((s) => s.source === "kernel").length;
  const docs =
    deals.length + calls.length + prices.length + signals.length + policies.length + stances.length;
  const n = (x: number, one: string, many = `${one}s`) =>
    `${x.toLocaleString("en-US")} ${x === 1 ? one : many}`;

  const rows: Row[] = [
    {
      name: "AgentMail",
      role: "Gives the agent its own email identity. It asks brokers for quotes, counters with offers from the other lines, and closes deals: the reply carrying your sealed details waits as a draft until you approve it, and contracts and signed receipts travel as PDFs.",
      live: `${n(deals.length, "deal")} · ${n(emails, "email")} in deal threads · ${n(emailLines, "email line")}`,
      on: !!process.env.AGENTMAIL_API_KEY,
      href: "/deals",
      where: "Deals",
    },
    {
      name: "Exa",
      role: "Market research the agent can cite: published rates for your exact profile, discount campaigns on insurers' own pages, and a 30-day replay that only sees what was published by each day.",
      live: `${n(published, "published price")} · ${n(campaigns, "campaign")} · ${n(hosts, "source")} · ${n(exaSignals, "signal")}`,
      on: !!process.env.EXA_API_KEY,
      href: "/policy/auto-northstar",
      where: "Auto policy",
    },
    {
      name: "Neon",
      role: "One Postgres is the shared memory between this dashboard and every agent, so an offer on one line is leverage on the others within seconds. Agents claim work atomically.",
      live: `${n(docs, "record")} · AI Gateway ${models.provider === "neon" ? `on (${models.chat})` : "off"}`,
      on: !!process.env.DATABASE_URL,
      off: "in-memory demo store",
      href: "/negotiation/auto-northstar",
      where: "Shared memory",
    },
    {
      name: "Fly.io",
      role: "Every negotiation line runs on its own Machine for as long as the conversation lasts, and a warm pool picks up new lines instantly.",
      live: `${fly ? `${fly.app}: ${fly.running} running, ${fly.warm} warm in ${fly.regions.join(", ")} · ` : ""}${n(machines, "machine")} used · ${n(calls.length, "negotiation line")}`,
      on: !!process.env.FLY_API_TOKEN,
      off: "lines run in-process",
      href: "/negotiation/auto-northstar",
      where: "Negotiation",
    },
    {
      name: "Mastra",
      role: "Three agents with typed tools: Lowball answers your questions, the strategist holds your limits and never says them, and the profile agent asks before it proposes edits.",
      live: "3 agents",
      on: true,
      href: "/profile",
      where: "Profile chat",
    },
    {
      name: "assistant-ui",
      role: "The Ask box and the profile chat. Tool calls become cards you can act on, like a proposed profile change with its effect on your premiums.",
      live: "2 chat surfaces",
      on: true,
      href: "/profile",
      where: "Profile chat",
    },
    {
      name: "Kernel",
      role: "A cloud browser starts cancelling online, reads the “please stay” offer, and stops before confirming. The offer becomes a price you can actually sign.",
      live: n(probes, "retention check"),
      on: !!process.env.KERNEL_API_KEY,
      off: "portal API fallback",
      href: "/insurers/northstar-mutual/cancel",
      where: "Cancel flow",
    },
    {
      name: "OpenAI GPT-Live",
      role: "The voice on the phone. It only ever hears shareable facts and the strategist's decisions.",
      live: models.provider
        ? `text models: ${models.provider} · ${models.chat}`
        : "no model configured",
      on: !!process.env.OPENAI_API_KEY,
      href: "/demo/receiver/1",
      where: "Demo phone",
    },
  ];

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-9 px-5 pt-7 pb-14">
      <Link
        href="/"
        className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium text-muted hover:text-ink"
      >
        <Back />
        All policies
      </Link>
      <section className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
          How Lowball works
        </h1>
        <p className="text-[17px] leading-[26px] text-ink-2">
          What each part does for you, with live numbers from this deployment.
        </p>
      </section>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex flex-col gap-1.5 border-t border-hair px-5 py-[18px] first:border-t-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[17px] leading-6 font-semibold">{r.name}</span>
              <span className={`text-[12px] font-semibold ${r.on ? "text-money" : "text-faint"}`}>
                {r.on ? "● live" : `○ ${r.off ?? "not configured"}`}
              </span>
            </div>
            <p className="text-[15px] leading-[23px] text-ink-2">{r.role}</p>
            <p className="num flex flex-wrap items-baseline gap-x-3 text-sm leading-5 text-subtle">
              <span>{r.live}</span>
              {r.href && (
                <Link href={r.href} className="text-accent underline-offset-2 hover:underline">
                  See it: {r.where}
                </Link>
              )}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
