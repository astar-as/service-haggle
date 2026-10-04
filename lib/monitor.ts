import { z } from "zod";
import { exaSearch, hasExa, hostOf, type Finding } from "@/mastra/research";
import { generateJson, hasModel } from "./models";
import * as seed from "./seed";
import { store } from "./store";
import type { MemberRate, Policy, Signal, Stance, Transaction } from "./types";

export interface LifeEvent {
  id: string;
  kind: "raise" | "driving_less";
  since: string;
  detectedOn: string;
  title: string;
  shareable?: string;
  disclosure: "private" | "shareable";
  kinds: string[];
  data: Record<string, number | string>;
}

export interface ReferenceFact {
  kind: string;
  label: string;
  say: string;
  url: string;
}

export const REFERENCE_FACTS: ReferenceFact[] = [
  {
    kind: "auto",
    label: "Prop 103 mileage factor · CA Dept. of Insurance",
    say: "California law makes annual miles driven one of the three mandatory rating factors, and insurers can rate on verified actual mileage.",
    url: "https://www.insurance.ca.gov/0400-news/0100-press-releases/0080-2009/upload/paydfinaltxtfiled101609.pdf",
  },
];

export const QUERIES: Record<string, string[]> = {
  auto: [
    "California auto insurance rate increase approved by the Department of Insurance",
    "low mileage car insurance discount California",
    "average cost of full coverage car insurance in San Francisco",
  ],
  health: ["Covered California 2027 health insurance premium rates", "California individual market silver plan premium changes 2027"],
  pet: ["pet insurance for cats accident and illness premium prices"],
  renters: ["renters insurance cost in San Francisco"],
  life: ["20-year term life insurance rates for a 30 year old non-smoker"],
};

const KIND_TERMS: Record<string, string[]> = {
  auto: ["auto", "car ", "cars", "vehicle", "driver", "mileage", "motor"],
  health: ["health", "covered california", "aca", "marketplace", "medical"],
  pet: ["pet", "cat", "dog", "veterinar"],
  renters: ["renter", "tenant", "contents"],
  life: ["life insurance", "term life", "term policy"],
};

const day = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return day(d);
};
const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${b.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${a.slice(0, 10)}T12:00:00Z`).getTime()) / 86400000);
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0;
};
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
export const today = () => day(new Date());

export function detectLifeEvents(transactions: Transaction[], asOf?: string): LifeEvent[] {
  const tx = transactions.filter((t) => !asOf || t.date <= asOf).sort((a, b) => a.date.localeCompare(b.date));
  const out: LifeEvent[] = [];

  const pay = tx.filter((t) => t.category === "payroll" && t.amount > 0);
  for (let i = pay.length - 1; i > 0; i--) {
    const prev = pay[i - 1].amount;
    const cur = pay[i].amount;
    if (cur >= prev * 1.05) {
      const pct = Math.round((cur / prev - 1) * 100);
      out.push({
        id: `life-raise-${pay[i].date}`,
        kind: "raise",
        since: pay[i].date,
        detectedOn: pay[i].date,
        title: `Paychecks up ${pct}% from ${shortDate(pay[i].date)}. Noted privately; nothing to change yet.`,
        disclosure: "private",
        kinds: ["life", "health"],
        data: { from: prev, to: cur, pct },
      });
      break;
    }
  }

  const gas = tx.filter((t) => t.category === "gas");
  if (gas.length >= 4) {
    const gaps = gas.slice(1).map((t, i) => daysBetween(gas[i].date, t.date));
    for (let i = 3; i < gaps.length + 1; i++) {
      const usual = median(gaps.slice(0, i - 1));
      const gap = i - 1 < gaps.length ? gaps[i - 1] : Infinity;
      if (!(gap > Math.max(7, usual * 2.5))) continue;
      const change = addDays(gas[i - 1].date, Math.max(1, Math.round(usual)));
      const end = asOf ?? tx[tx.length - 1]?.date ?? change;
      const postDays = daysBetween(change, end) + 1;
      if (postDays < 28) break;
      const spend = (from: string, to: string) =>
        gas.filter((t) => t.date >= from && t.date < to).reduce((s, t) => s - t.amount, 0);
      const beforeRate = spend(addDays(change, -28), change) / 28;
      const afterRate = spend(change, addDays(end, 1)) / postDays;
      if (beforeRate <= 0) break;
      const drop = 1 - afterRate / beforeRate;
      if (drop < 0.4) break;
      const pct = Math.round(drop * 100);
      const onFile = 12000;
      const estMiles = Math.round((onFile * (1 - drop)) / 500) * 500;
      out.push({
        id: `life-driving-less-${change}`,
        kind: "driving_less",
        since: change,
        detectedOn: addDays(change, 27),
        title: `Gas spend down ${pct}% since ${shortDate(change)}. Likely under 7,500 miles a year now, not 12,000.`,
        shareable: "she's been driving far less since August",
        disclosure: "shareable",
        kinds: ["auto"],
        data: { dropPct: pct, estMiles, beforeWeekly: Math.round(beforeRate * 7), afterWeekly: Math.round(afterRate * 7) },
      });
      break;
    }
  }
  return out;
}

export interface NetworkStats {
  insurer: string;
  kind: string;
  profile: string;
  count: number;
  min: number;
  max: number;
  median: number;
  market: { count: number; median: number; insurers: { insurer: string; count: number; min: number; max: number }[] };
}

export async function networkStats(policy: Policy): Promise<NetworkStats | null> {
  const kindRates = await store.memberRates({ kind: policy.kind });
  const own = kindRates.filter((m) => m.insurer === policy.insurer);
  if (!own.length) return null;
  const profile = own[0].profile;
  const sameProfile = kindRates.filter((m) => m.profile === profile);
  const groups = new Map<string, MemberRate[]>();
  for (const m of sameProfile) groups.set(m.insurer, [...(groups.get(m.insurer) ?? []), m]);
  const vals = own.map((m) => m.monthly);
  return {
    insurer: policy.insurer,
    kind: String(policy.kind),
    profile,
    count: own.length,
    min: Math.min(...vals),
    max: Math.max(...vals),
    median: median(vals),
    market: {
      count: sameProfile.length,
      median: median(sameProfile.map((m) => m.monthly)),
      insurers: [...groups.entries()].map(([insurer, ms]) => ({
        insurer,
        count: ms.length,
        min: Math.min(...ms.map((m) => m.monthly)),
        max: Math.max(...ms.map((m) => m.monthly)),
      })),
    },
  };
}

export function networkLine(n: NetworkStats) {
  return `${n.count} Lowball members with your profile pay ${usd(n.min)}–${usd(n.max)} at ${n.insurer}.`;
}

export interface Anchors {
  fair: number;
  walkAway: number;
}

export function computeAnchors(policy: Policy, net: NetworkStats | null, existing?: Stance): Anchors {
  if (!net) {
    const fair = existing?.fairMonthly ?? policy.monthlyPremium;
    return { fair, walkAway: existing?.walkAwayMonthly ?? Math.max(fair, Math.round(fair * 1.07)) };
  }
  const fair = Math.round(net.market.median);
  return { fair: Math.min(fair, policy.monthlyPremium), walkAway: Math.max(Math.min(net.max, policy.monthlyPremium), fair) };
}

function relevance(f: Finding, kind: string) {
  const text = `${f.title} ${f.highlight}`.toLowerCase();
  if (!text.includes("insur")) return 0;
  const terms = KIND_TERMS[kind] ?? [kind.toLowerCase()];
  const hits = terms.filter((t) => text.includes(t)).length;
  if (!hits) return 0;
  return hits + (text.includes("california") ? 1 : 0) + (/\d+(\.\d+)?\s?%|\$\s?\d/.test(text) ? 1 : 0);
}

export function relevantFindings(findings: Finding[], kind: string, limit = 3) {
  const seen = new Set<string>();
  return findings
    .map((f) => ({ f, score: relevance(f, String(kind)) }))
    .filter((x) => x.score > 0 && !seen.has(x.f.url) && seen.add(x.f.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

export async function research(policy: Policy, window?: { start?: string; end?: string }) {
  if (!hasExa()) return [];
  const queries = QUERIES[String(policy.kind)] ?? [`${policy.kind} insurance price changes in California`];
  const settled = await Promise.allSettled(queries.map((q) => exaSearch(q, window)));
  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  for (const r of settled) if (r.status === "rejected") console.error("[monitor] exa search failed:", r.reason);
  return relevantFindings(all, String(policy.kind), 6);
}

function findingTitle(f: Finding) {
  const t = f.title.length > 110 ? `${f.title.slice(0, 107)}…` : f.title;
  return `${hostOf(f.url)}: ${t}`;
}

function signalFromFinding(f: Finding, policy: Policy, asOf: string, title?: string): Signal {
  return {
    id: `sig-exa-${policy.id}-${hash(f.url)}`,
    personId: policy.personId,
    policyId: policy.id,
    at: (f.publishedDate ?? asOf).slice(0, 10) <= asOf ? (f.publishedDate ?? asOf).slice(0, 10) : asOf,
    source: "exa",
    title: title ?? findingTitle(f),
    url: f.url,
  };
}

const StanceOut = z.object({
  verdict: z.enum(["overpaying", "fair", "waiting", "negotiating", "won"]),
  fairMonthly: z.number(),
  walkAwayMonthly: z.number().nullable().optional(),
  headline: z.string(),
  detail: z.string(),
  activity: z.string(),
  signals: z
    .array(z.object({ finding: z.number().int(), title: z.string(), impactMonthly: z.number().nullable().optional() }))
    .optional()
    .default([]),
});

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => (s.match(/[.!?](\s|$)/g) ?? []).length;
const BANNED = /next check|tomorrow|schedul|salary|raise|income|\$1\d\d,\d{3}|118,000|walk.?away/i;

export interface CheckOptions {
  findings?: Finding[];
  research?: boolean;
  knowsNetwork?: boolean;
  emitSignals?: boolean;
  useModel?: boolean;
}

export interface CheckResult {
  stance: Stance;
  signals: Signal[];
  findings: Finding[];
  usedModel: boolean;
}

function activityFor(policy: Policy, verdict: Stance["verdict"], asOf: string) {
  if (verdict !== "overpaying") return verdict === "waiting" ? "reading the market" : "";
  return daysBetween(asOf, policy.renewsOn) <= 30 ? "calling before renewal" : "ready to negotiate";
}

function deterministicStance(
  policy: Policy,
  existing: Stance | undefined,
  anchors: Anchors,
  net: NetworkStats | null,
  life: LifeEvent[],
  findings: Finding[],
  asOf: string,
  knowsNetwork: boolean,
): Stance {
  const now = new Date().toISOString();
  const premium = policy.monthlyPremium;
  if (existing && (existing.verdict === "won" || existing.verdict === "negotiating") && premium <= anchors.walkAway) {
    return { ...existing, updatedAt: existing.updatedAt };
  }
  if (!knowsNetwork || !net) {
    return {
      policyId: policy.id,
      verdict: "waiting",
      fairMonthly: existing?.fairMonthly ?? premium,
      walkAwayMonthly: existing?.walkAwayMonthly,
      headline: findings.length ? "Reading the market." : "Watching this one.",
      detail: `Your ${policy.insurer} renewal is ${shortDate(policy.renewsOn)} at ${usd(premium)} a month. I'm checking what people like you pay before I take a position.`,
      activity: "reading the market",
      updatedAt: now,
    };
  }
  const drivingLess = life.find((e) => e.kind === "driving_less" && e.kinds.includes(String(policy.kind)));
  if (premium > anchors.walkAway) {
    const gap = Math.round(premium - anchors.fair);
    const activity = activityFor(policy, "overpaying", asOf);
    const close = activity === "calling before renewal" ? `I'm calling before the ${shortDate(policy.renewsOn)} renewal.` : `I'll negotiate before the ${shortDate(policy.renewsOn)} renewal.`;
    return {
      policyId: policy.id,
      verdict: "overpaying",
      fairMonthly: anchors.fair,
      walkAwayMonthly: anchors.walkAway,
      headline: `Overpaying about ${usd(gap)} a month.`,
      detail: `${policy.kind === "auto" ? "Drivers" : "People"} with your profile pay ${usd(net.min)}–${usd(net.max)} at ${policy.insurer}${drivingLess ? ", and you've been driving far less since August" : ""}. ${close}`,
      activity,
      updatedAt: now,
    };
  }
  return {
    policyId: policy.id,
    verdict: "fair",
    fairMonthly: anchors.fair,
    walkAwayMonthly: anchors.walkAway,
    headline: "Fair.",
    detail: `${net.count} members with your profile pay ${usd(net.min)}–${usd(net.max)} at ${policy.insurer}. Leaving it alone.`,
    activity: "",
    updatedAt: now,
  };
}

export async function checkPolicy(policyId: string, asOf: string = today(), opts: CheckOptions = {}): Promise<CheckResult> {
  const policy = await store.policy(policyId);
  if (!policy) throw new Error(`Unknown policy ${policyId}`);
  const existing = await store.stance(policyId);
  const life = detectLifeEvents(await store.transactions(), asOf);
  const net = await networkStats(policy);
  const anchors = computeAnchors(policy, net, existing);
  const knowsNetwork = opts.knowsNetwork ?? true;
  const findings =
    opts.findings ??
    (opts.research === false ? [] : await research(policy, { start: `${addDays(asOf, -30)}T00:00:00.000Z`, end: `${asOf}T23:59:59.999Z` }));

  const base = deterministicStance(policy, existing, anchors, net, life, findings, asOf, knowsNetwork);
  let stance = base;
  let picked: { finding: number; title: string; impactMonthly?: number | null }[] = [];
  let usedModel = false;

  const locked = base.verdict === "won" || base.verdict === "negotiating";
  if (hasModel() && opts.useModel !== false && !locked) {
    try {
      const person = await store.person();
      const out = await generateJson(StanceOut, {
        tier: "smart",
        timeoutMs: 25000,
        system: `You are Lowball's strategist: an autonomous insurance agent that holds a stance on each of ${person.firstName}'s policies.
Write in first person to ${person.firstName}, plain and calm ("I'm holding until…", "Leaving it alone."). Never use scheduling language ("next check", "tomorrow").
Rules:
- headline: at most 8 words. detail: at most 2 sentences. activity: at most 5 words, lowercase, or "" when nothing to do.
- Cite only evidence given below. Never invent sources, numbers, or insurer behavior. Market claims must come from the numbered findings.
- Never mention salary, income, raises, or any walk-away/limit in headline/detail.
- Lowball network numbers and bank data are the user's own data; you may refer to them.
- signals: pick at most 2 findings that matter for this policy; write each title (max 16 words) strictly from that finding's text. Use the finding number.`,
          prompt: JSON.stringify(
            {
              asOf,
              policy: { insurer: policy.insurer, kind: policy.kind, product: policy.product, monthlyPremium: policy.monthlyPremium, renewsOn: policy.renewsOn, facts: policy.facts.filter((f) => f.disclosure !== "hidden") },
              currentStance: existing,
              computed: { verdict: base.verdict, fairMonthly: anchors.fair, walkAwayMonthly: anchors.walkAway, activity: base.activity },
              network: knowsNetwork ? net : null,
              lifeEvents: life.filter((e) => e.kinds.includes(String(policy.kind))).map((e) => ({ kind: e.kind, since: e.since, title: e.title, disclosure: e.disclosure })),
              findings: findings.map((f, i) => ({ n: i, title: f.title, url: f.url, published: f.publishedDate?.slice(0, 10), text: f.highlight.slice(0, 900) })),
              output: "{verdict, fairMonthly, walkAwayMonthly, headline, detail, activity, signals:[{finding, title, impactMonthly?}]}",
            },
            null,
            1,
          ),
      });
      usedModel = true;
      picked = out.signals.filter((s) => findings[s.finding]);
      const okText =
        out.verdict === base.verdict &&
        words(out.headline) <= 8 &&
        sentences(out.detail) <= 2 &&
        words(out.activity) <= 5 &&
        !BANNED.test(`${out.headline} ${out.detail} ${out.activity}`);
      if (okText) {
        const fair = net ? Math.min(Math.max(Math.round(out.fairMonthly), net.min), policy.monthlyPremium) : base.fairMonthly;
        const walk = out.walkAwayMonthly && net ? Math.min(Math.max(Math.round(out.walkAwayMonthly), fair), net.max) : base.walkAwayMonthly;
        stance = {
          ...base,
          fairMonthly: base.verdict === "overpaying" ? fair : base.fairMonthly,
          walkAwayMonthly: base.verdict === "overpaying" ? walk : base.walkAwayMonthly,
          headline: out.headline.trim(),
          detail: out.detail.trim(),
          activity: base.verdict === "overpaying" ? base.activity : out.activity.trim(),
        };
        if (stance.verdict === "overpaying") stance.headline = `Overpaying about ${usd(policy.monthlyPremium - stance.fairMonthly)} a month.`;
      }
    } catch (e) {
      console.error(`[monitor] strategist model failed for ${policyId}:`, e instanceof Error ? e.message : e);
    }
  }

  await store.putStance(stance);

  const signals: Signal[] = [];
  if (opts.emitSignals !== false) {
    const chosen = usedModel
      ? picked.map((p) => ({ f: findings[p.finding], title: p.title.slice(0, 160), impact: p.impactMonthly ?? undefined }))
      : findings.slice(0, 2).map((f) => ({ f, title: undefined, impact: undefined }));
    const existingIds = new Set((await store.signals(policyId)).map((s) => s.id));
    for (const c of chosen) {
      const s = { ...signalFromFinding(c.f, policy, asOf, c.title), ...(c.impact ? { impactMonthly: c.impact } : {}) };
      if (existingIds.has(s.id)) continue;
      await store.addSignal(s);
      signals.push(s);
    }
  }
  return { stance, signals, findings, usedModel };
}

export interface NegotiationTarget {
  policyId: string;
  insurer: string;
  kind: string;
  premium: number;
  fair: number;
  gap: number;
  renewsOn: string;
  channel: "call" | "email";
}

export async function negotiationTargets(): Promise<NegotiationTarget[]> {
  const [policies, stances] = await Promise.all([store.policies(), store.stances()]);
  const byId = new Map(stances.map((s) => [s.policyId, s]));
  return policies
    .filter((p) => byId.get(p.id)?.verdict === "overpaying")
    .map((p) => {
      const s = byId.get(p.id)!;
      return {
        policyId: p.id,
        insurer: p.insurer,
        kind: String(p.kind),
        premium: p.monthlyPremium,
        fair: s.fairMonthly,
        gap: p.monthlyPremium - s.fairMonthly,
        renewsOn: p.renewsOn,
        channel: (p.phone || p.kind !== "health" ? "call" : "email") as "call" | "email",
      };
    })
    .sort((a, b) => b.gap - a.gap);
}

export interface ReplayState {
  running: boolean;
  startedAt?: string;
  finishedAt?: string;
  day?: string;
  index: number;
  total: number;
  exa: boolean;
  model: boolean;
  log: string[];
  error?: string;
}

const g = globalThis as unknown as { __replay?: ReplayState };
export const replayStatus = (): ReplayState => g.__replay ?? { running: false, index: 0, total: 0, exa: hasExa(), model: hasModel(), log: [] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pool<T>(items: (() => Promise<T>)[], size: number): Promise<Promise<T>[]> {
  const results: Promise<T>[] = [];
  let active = 0;
  const queue: (() => void)[] = [];
  for (const job of items) {
    results.push(
      (async () => {
        if (active >= size) await new Promise<void>((r) => queue.push(r));
        active++;
        try {
          return await job();
        } finally {
          active--;
          queue.shift()?.();
        }
      })(),
    );
  }
  return results;
}

const TitlesOut = z.object({ picks: z.array(z.object({ finding: z.number().int(), title: z.string() })) });

async function titleFindings(findings: { f: Finding; policy: Policy }[]) {
  const titles = new Map<string, string>();
  if (!findings.length || !hasModel()) return titles;
  try {
    const out = await generateJson(TitlesOut, {
      tier: "fast",
      timeoutMs: 12000,
      system:
        "You turn insurance market research into one-line monitoring signals for a personal insurance agent. For each finding that is genuinely about prices, rates, filings or discounts for that policy type, write a factual title of at most 16 words using only facts stated in the finding text. Skip findings that are off-topic. Never add facts.",
      prompt: JSON.stringify({
        findings: findings.map(({ f, policy }, i) => ({ n: i, policyKind: policy.kind, title: f.title, published: f.publishedDate?.slice(0, 10), text: f.highlight.slice(0, 700) })),
        output: "{picks:[{finding, title}]}",
      }),
    });
    for (const p of out.picks) if (findings[p.finding]) titles.set(findings[p.finding].f.url, p.title.slice(0, 160));
    for (const { f } of findings) if (!titles.has(f.url)) titles.set(f.url, "");
  } catch (e) {
    console.error("[monitor] title model failed:", e instanceof Error ? e.message : e);
  }
  return titles;
}

export async function replay(opts: { days?: number; endDate?: string; delayMs?: number; useExa?: boolean; useModel?: boolean } = {}) {
  if (g.__replay?.running) throw new Error("A replay is already running.");
  const days = Math.max(1, Math.min(opts.days ?? 30, 60));
  const endDate = opts.endDate ?? "2026-10-04";
  const delayMs = opts.delayMs ?? 600;
  const useExa = (opts.useExa ?? true) && hasExa();
  const state: ReplayState = { running: true, startedAt: new Date().toISOString(), index: 0, total: days, exa: useExa, model: hasModel() && opts.useModel !== false, log: [] };
  g.__replay = state;
  const log = (m: string) => {
    state.log.push(m);
    if (state.log.length > 200) state.log.shift();
  };
  if (!useExa) log(hasExa() ? "Exa disabled for this replay." : "EXA_API_KEY not set: replaying with bank and network data only.");

  try {
    const seedSignalIds = new Set(seed.signals.map((s) => s.id));
    await store.clearSignals((s) => !seedSignalIds.has(s.id));

    const policies = await store.policies();
    for (const sp of seed.policies) {
      const cur = policies.find((p) => p.id === sp.id);
      if (cur && cur.monthlyPremium !== sp.monthlyPremium) await store.putPolicy(structuredClone(sp));
    }
    const fresh = await store.policies();
    const nets = new Map<string, NetworkStats | null>();
    for (const p of fresh) nets.set(p.id, await networkStats(p));

    for (const p of fresh) {
      const s = seed.stances.find((x) => x.policyId === p.id);
      const net = nets.get(p.id) ?? null;
      const anchors = computeAnchors(p, net, s);
      const open = !s || p.monthlyPremium > anchors.walkAway;
      if (open) {
        await store.putStance(deterministicStance(p, undefined, anchors, net, [], [], addDays(endDate, -(days - 1)), false));
      } else if (s) {
        await store.putStance({ ...structuredClone(s) });
      }
    }

    const dates = Array.from({ length: days }, (_, i) => addDays(endDate, i - (days - 1)));
    const ordered = [...fresh].sort(
      (a, b) =>
        b.monthlyPremium - computeAnchors(b, nets.get(b.id) ?? null).fair - (a.monthlyPremium - computeAnchors(a, nets.get(a.id) ?? null).fair),
    );
    const pairs: { policy: Policy; query: string }[] = [];
    const maxQ = Math.max(...ordered.map((p) => (QUERIES[String(p.kind)] ?? [""]).length));
    for (let qi = 0; qi < maxQ; qi++)
      for (const p of ordered) {
        const qs = QUERIES[String(p.kind)] ?? [`${p.kind} insurance price changes in California`];
        if (qs[qi]) pairs.push({ policy: p, query: qs[qi] });
      }

    const prefetch: Promise<{ f: Finding; policy: Policy; title?: string }[]>[] = useExa
      ? await pool(
          dates.map((d, i) => async () => {
            const jobs = [pairs[(2 * i) % pairs.length], pairs[(2 * i + 1) % pairs.length]];
            const found: { f: Finding; policy: Policy }[] = [];
            for (const job of jobs) {
              try {
                const res = await exaSearch(job.query, { start: `${d}T00:00:00.000Z`, end: `${d}T23:59:59.999Z` });
                const best = relevantFindings(res, String(job.policy.kind), 1)[0];
                if (best && !found.some((x) => x.f.url === best.url)) found.push({ f: best, policy: job.policy });
              } catch (e) {
                log(`Exa search failed on ${d}: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
            const titles = state.model ? await titleFindings(found) : new Map<string, string>();
            return found
              .filter(({ f }) => !titles.size || titles.get(f.url) !== "")
              .map((x) => ({ ...x, title: titles.get(x.f.url) || undefined }));
          }),
          4,
        )
      : dates.map(() => Promise.resolve([]));

    const tx = await store.transactions();
    const emittedLife = new Set<string>();
    const networkDay = new Map<string, number>();
    ordered.forEach((p, k) => networkDay.set(p.id, Math.min(days - 2, 3 + k * 3)));
    const known = new Map<string, boolean>();
    const accumulated = new Map<string, Finding[]>();
    const person = await store.person();

    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      state.day = d;
      state.index = i + 1;
      const touched = new Set<string>();

      for (const e of detectLifeEvents(tx, d)) {
        if (emittedLife.has(e.id) || e.detectedOn > d) continue;
        emittedLife.add(e.id);
        const target = fresh.find((p) => e.kinds[0] === String(p.kind));
        await store.addSignal({
          id: `sig-bank-${e.id}`,
          personId: person.id,
          policyId: e.kind === "driving_less" ? target?.id : undefined,
          at: d,
          source: "bank",
          title: e.title,
        });
        if (target && e.kind === "driving_less") touched.add(target.id);
        log(`${d}: bank · ${e.title}`);
      }

      for (const p of fresh) {
        if (networkDay.get(p.id) !== i) continue;
        const net = nets.get(p.id);
        if (!net) continue;
        known.set(p.id, true);
        const anchors = computeAnchors(p, net);
        await store.addSignal({
          id: `sig-network-${p.id}`,
          personId: p.personId,
          policyId: p.id,
          at: d,
          source: "network",
          title: networkLine(net),
          ...(p.monthlyPremium > anchors.walkAway ? { impactMonthly: -(p.monthlyPremium - anchors.fair) } : {}),
        });
        touched.add(p.id);
        log(`${d}: network · ${networkLine(net)}`);
      }

      for (const { f, policy, title } of await prefetch[i]) {
        const s = signalFromFinding(f, policy, d, title);
        await store.addSignal({ ...s, at: d });
        accumulated.set(policy.id, [...(accumulated.get(policy.id) ?? []), f]);
        touched.add(policy.id);
        log(`${d}: exa · ${s.title}`);
      }

      for (const id of touched) {
        const cur = await store.stance(id);
        if (cur && (cur.verdict === "won" || cur.verdict === "fair")) continue;
        await checkPolicy(id, d, { findings: accumulated.get(id) ?? [], knowsNetwork: !!known.get(id), emitSignals: false, useModel: false });
      }

      if (i < dates.length - 1) await sleep(delayMs);
    }

    for (const p of fresh) {
      await checkPolicy(p.id, endDate, {
        findings: accumulated.get(p.id) ?? [],
        knowsNetwork: true,
        emitSignals: false,
        useModel: state.model,
      });
    }
    const targets = await negotiationTargets();
    log(`Done. Flagged for negotiation: ${targets.map((t) => `${t.insurer} (${t.channel})`).join(", ") || "none"}.`);
    state.finishedAt = new Date().toISOString();
    return { targets, log: state.log };
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
    log(`Replay failed: ${state.error}`);
    throw e;
  } finally {
    state.running = false;
  }
}

export async function handleMonitorWebhook(body: unknown) {
  const results: { url: string; title?: string; publishedDate?: string; highlights?: string[] }[] = [];
  let policyId: string | undefined;
  const walk = (v: unknown, depth = 0) => {
    if (!v || typeof v !== "object" || depth > 6) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    const o = v as Record<string, unknown>;
    if (typeof o.policyId === "string") policyId ??= o.policyId;
    if (typeof o.url === "string" && /^https?:/.test(o.url) && ("title" in o || "highlights" in o)) {
      results.push({ url: o.url, title: o.title as string | undefined, publishedDate: o.publishedDate as string | undefined, highlights: o.highlights as string[] | undefined });
    }
    for (const x of Object.values(o)) walk(x, depth + 1);
  };
  walk(body);
  const policies = await store.policies();
  const policy = policies.find((p) => p.id === policyId) ?? policies[0];
  if (!policy) return { added: 0 };
  const findings: Finding[] = results.map((r) => ({
    title: r.title ?? hostOf(r.url),
    url: r.url,
    publishedDate: r.publishedDate,
    highlight: (r.highlights ?? []).join(" … "),
    query: "monitor",
  }));
  const keep = relevantFindings(findings, String(policy.kind), 3);
  const existing = new Set((await store.signals(policy.id)).map((s) => s.id));
  let added = 0;
  for (const f of keep) {
    const s = signalFromFinding(f, policy, today());
    if (existing.has(s.id)) continue;
    await store.addSignal(s);
    added++;
  }
  return { added, policyId: policy.id };
}

export async function createExaMonitors(webhookUrl: string) {
  if (!process.env.EXA_API_KEY) throw new Error("EXA_API_KEY is not set");
  const { default: Exa } = await import("exa-js");
  const exa = new Exa(process.env.EXA_API_KEY);
  const out: { policyId: string; monitorId: string; webhookSecret: string }[] = [];
  for (const p of await store.policies()) {
    const query = (QUERIES[String(p.kind)] ?? [`${p.kind} insurance price changes in California`])[0];
    const m = await exa.monitors.create({
      name: `Lowball · ${p.insurer} ${p.kind}`,
      search: { query, contents: { highlights: true } },
      trigger: { type: "interval", period: "1d" },
      webhook: { url: webhookUrl },
      metadata: { policyId: p.id },
    });
    out.push({ policyId: p.id, monitorId: m.id, webhookSecret: m.webhookSecret });
  }
  return out;
}
