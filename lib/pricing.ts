import snapshot from "@/data/market-offers.json";
import {
  isInsurerName,
  scanCampaigns,
  scanOffers,
  type Campaign,
  type OfferScan,
  type PublishedOffer,
} from "@/mastra/offers";
import { hasExa, hostOf } from "@/mastra/research";
import { detectLifeEvents } from "./monitor";
import { store } from "./store";
import type { Call, Policy, PriceCandidate } from "./types";

// The price ledger: every price Maya could pay for a policy, from four kinds of evidence.
//   published  benchmark rates from rate studies and comparison pages (estimate)
//   campaign   a published rate with a discount she qualifies for applied (estimate)
//   network    what Service Haggle members with her profile pay at her insurer (estimate)
//   quote / retention   offered to her directly on a call, email or cancel flow (obtainable)
// The cheapest obtainable price is what we can actually sign; the cheapest estimate is the
// anchor the agent pushes toward.

// Discounts a clean-record benchmark rate already includes; applying them again double counts.
const ALREADY_PRICED =
  /good driver|clean (driving )?record|safe driver|accident.?free|claims.?free|exceptional driver|good student|defensive driver/i;

export interface PriceBoard {
  policyId: string;
  premium: number;
  bestEstimate?: PriceCandidate;
  bestObtainable?: PriceCandidate;
  candidates: PriceCandidate[];
}

const byMonthly = (a: PriceCandidate, b: PriceCandidate) => a.monthly - b.monthly;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function priceBoard(policyId: string): Promise<PriceBoard> {
  const [policy, stored, calls, rates] = await Promise.all([
    store.policy(policyId),
    store.prices(policyId),
    store.calls(),
    store.memberRates(),
  ]);
  if (!policy) throw new Error(`Unknown policy ${policyId}`);
  const candidates = [...stored, ...fromCalls(calls, policyId), ...fromNetwork(policy, rates)].sort(
    byMonthly,
  );
  return {
    policyId,
    premium: policy.monthlyPremium,
    bestEstimate: candidates.find((c) => !c.obtainable),
    bestObtainable: candidates.find((c) => c.obtainable),
    candidates,
  };
}

export async function refreshPrices(policyId: string): Promise<PriceBoard> {
  const [policy, person] = await Promise.all([store.policy(policyId), store.person()]);
  if (!policy) throw new Error(`Unknown policy ${policyId}`);
  const before = (await priceBoard(policyId)).bestEstimate;

  // Exa results vary run to run; top up a thin scan with the last good snapshot.
  const fallback = snapshotScan(policyId)?.offers.filter((o) => isInsurerName(o.insurer)) ?? [];
  const scanned = hasExa()
    ? ((await scanOffers(policy).catch((e) => (console.error("[pricing] offers:", e), undefined)))
        ?.offers ?? [])
    : [];
  const offers = scanned.length >= 3 ? scanned : dedupeOffers([...scanned, ...fallback]);

  // Campaigns only matter for the insurers that could actually beat her premium.
  const contenders = [
    ...new Set(offers.filter((o) => o.monthly < policy.monthlyPremium).map((o) => o.insurer)),
  ].slice(0, 4);
  // Other policies she holds unlock bundle discounts; shareable life events unlock others
  // (e.g. low-mileage when she's driving less).
  const others = (await store.policies())
    .filter((p) => p.id !== policy.id)
    .map((p) => String(p.kind));
  const lifeEvents = detectLifeEvents(await store.transactions())
    .filter(
      (e) => e.disclosure === "shareable" && e.shareable && e.kinds.includes(String(policy.kind)),
    )
    .map((e) => e.shareable!);
  const profile = [...person.facts, ...policy.facts]
    .filter((f) => f.disclosure === "shareable")
    .map((f) => `${f.label}: ${f.value}`)
    .concat(
      `Lives in ${person.city}, ${person.state}`,
      `Product: ${policy.product}`,
      `Also has ${others.join(", ")} insurance`,
      ...lifeEvents,
    )
    .join("; ");
  const campaigns =
    hasExa() && contenders.length
      ? (
          await scanCampaigns(String(policy.kind), contenders, profile).catch(
            (e) => (console.error("[pricing] campaigns:", e), { campaigns: [] as Campaign[] }),
          )
        ).campaigns
      : [];

  if (process.env.PRICING_DEBUG)
    console.log(
      "[pricing] campaigns",
      policyId,
      contenders,
      campaigns.map((c) => `${c.fitsProfile} ${c.percentOff ?? "-"}% ${c.insurer}: ${c.offer}`),
    );
  const at = new Date().toISOString();
  const fresh: PriceCandidate[] = [
    ...offers.map((o) => publishedCandidate(policyId, o, at)),
    ...campaignCandidates(policyId, offers, campaigns, at),
  ];
  for (const old of await store.prices(policyId)) {
    if (
      (old.source === "published" || old.source === "campaign") &&
      !fresh.some((f) => f.id === old.id)
    )
      await store.removePrice(old.id);
  }
  for (const c of fresh) await store.putPrice(c);

  const board = await priceBoard(policyId);
  const best = board.bestEstimate;
  if (best && best.monthly < policy.monthlyPremium && (!before || best.monthly < before.monthly)) {
    await store.addSignal({
      id: `sig-price-${policyId}-${slug(best.insurer)}-${best.monthly}`,
      personId: policy.personId,
      policyId,
      at: at.slice(0, 10),
      source: "exa",
      title: `Lowest price found: ${best.insurer} at $${best.monthly}/mo, ${best.source === "campaign" ? "with a campaign" : "published"} for ${firstClause(best.basis)}.`,
      url: best.url,
      impactMonthly: best.monthly - policy.monthlyPremium,
    });
  }
  return board;
}

export async function refreshAll() {
  const policies = await store.policies();
  return Promise.allSettled(policies.map((p) => refreshPrices(p.id)));
}

function publishedCandidate(policyId: string, o: PublishedOffer, at: string): PriceCandidate {
  return {
    id: `price-${policyId}-pub-${slug(o.insurer)}-${o.monthly}`,
    policyId,
    insurer: o.insurer,
    source: "published",
    monthly: o.monthly,
    obtainable: false,
    basis: `${firstClause(o.appliesTo)} · ${hostOf(o.url)}`,
    url: o.url,
    at,
  };
}

// One campaign per insurer: the largest stated discount she clearly qualifies for, applied to
// that insurer's cheapest published rate. Never stacked.
function campaignCandidates(
  policyId: string,
  offers: PublishedOffer[],
  campaigns: Campaign[],
  at: string,
): PriceCandidate[] {
  const out: PriceCandidate[] = [];
  const insurers = new Set(campaigns.map((c) => c.insurer));
  for (const insurer of insurers) {
    const base = offers
      .filter((o) => sameInsurer(o.insurer, insurer))
      .sort((a, b) => a.monthly - b.monthly)[0];
    const best = campaigns
      .filter(
        (c) =>
          sameInsurer(c.insurer, insurer) &&
          c.fitsProfile === "yes" &&
          c.percentOff &&
          !ALREADY_PRICED.test(c.offer),
      )
      .sort((a, b) => (b.percentOff ?? 0) - (a.percentOff ?? 0))[0];
    if (!base || !best?.percentOff) continue;
    const monthly = Math.round(base.monthly * (1 - best.percentOff / 100));
    out.push({
      id: `price-${policyId}-camp-${slug(base.insurer)}-${monthly}`,
      policyId,
      insurer: base.insurer,
      source: "campaign",
      monthly,
      obtainable: false,
      basis: `${best.offer}, −${best.percentOff}% on the published $${base.monthly}`,
      url: best.url,
      expiresOn: best.endsOn,
      at,
    });
  }
  return out;
}

function fromCalls(calls: Call[], policyId: string): PriceCandidate[] {
  return calls
    .filter((c) => c.policyId === policyId && (c.agreedMonthly ?? c.theirOffer))
    .map((c) => ({
      id: `price-call-${c.id}`,
      policyId,
      insurer: c.insurer,
      source: c.role === "retention" ? "retention" : "quote",
      monthly: (c.agreedMonthly ?? c.theirOffer)!,
      obtainable: true,
      basis: `${c.agreedMonthly ? "agreed" : "offered"} on a ${c.channel === "email" ? "email thread" : "call"} with ${c.counterpart}`,
      at: c.endedAt ?? c.startedAt,
    }));
}

function fromNetwork(
  policy: Policy,
  rates: { insurer: string; kind: string; monthly: number }[],
): PriceCandidate[] {
  const own = rates
    .filter((r) => r.kind === policy.kind && r.insurer === policy.insurer)
    .map((r) => r.monthly);
  if (!own.length) return [];
  const min = Math.min(...own);
  return [
    {
      id: `price-${policy.id}-network`,
      policyId: policy.id,
      insurer: policy.insurer,
      source: "network",
      monthly: min,
      obtainable: false,
      basis: `lowest of ${own.length} Service Haggle members with her profile at ${policy.insurer}`,
      at: new Date().toISOString(),
    },
  ];
}

const sameInsurer = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().replace(/\binsurance\b|\bauto\b|[^a-z]/g, "");
  return n(a).startsWith(n(b)) || n(b).startsWith(n(a));
};

const firstClause = (s: string) => s.split(/ · |\. |; /)[0].replace(/\.$/, "");

function dedupeOffers(offers: PublishedOffer[]) {
  const seen = new Set<string>();
  return offers
    .filter((o) => {
      const key = `${o.insurer.toLowerCase()}|${o.monthly}`;
      return !seen.has(key) && seen.add(key);
    })
    .sort((a, b) => a.monthly - b.monthly);
}

function snapshotScan(policyId: string): OfferScan | undefined {
  return (snapshot as OfferScan[]).find((s) => s.policyId === policyId);
}
