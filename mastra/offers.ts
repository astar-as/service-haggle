import Exa from "exa-js";
import type { Policy } from "@/lib/types";

// Published insurer prices for a policy's profile, pulled from rate studies and comparison
// pages via Exa structured output. These are benchmarks, not personal quotes: every offer
// carries the profile the page says the price applies to, plus a verbatim quote and URL.

export interface PublishedOffer {
  insurer: string;
  monthly: number;
  appliesTo: string;
  quote: string;
  url: string;
}

export interface OfferScan {
  policyId: string;
  kind: string;
  query: string;
  offers: PublishedOffer[];
  sources: number;
  costDollars?: number;
  scannedAt: string;
}

export type ScanDepth = "auto" | "deep";

// Queries carry only shareable profile facts (age band, city, coverage), never private ones.
export const OFFER_QUERIES: Record<string, string> = {
  auto: "full coverage car insurance rates by company for a 29-year-old driver in San Francisco with a clean record",
  health:
    "Covered California silver plan monthly premiums by insurer for a 29-year-old in San Francisco",
  pet: "cat accident and illness pet insurance monthly cost by company",
  life: "20-year $500,000 term life insurance monthly rates by company for a 29-year-old non-smoker",
  renters:
    "renters insurance monthly cost by company in San Francisco for $30,000 personal property coverage",
};

const SYSTEM_PROMPT =
  "Extract premiums that a page explicitly states for a named insurance company. Convert annual figures to monthly by dividing by 12 and round to whole dollars. For each price, set appliesTo to at most 15 words describing the profile and coverage the page says the rate applies to (age, location, coverage level), with no commentary. Omit any price that is not attributed to a named insurer or cannot be quoted from the page; never estimate.";

const OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    offers: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          insurer: { type: "string" as const },
          monthly: { type: "number" as const },
          appliesTo: { type: "string" as const },
          quote: { type: "string" as const },
          url: { type: "string" as const },
        },
        required: ["insurer", "monthly", "appliesTo", "quote", "url"],
      },
    },
  },
  required: ["offers"],
};

let client: Exa | null = null;
function exa() {
  if (!process.env.EXA_API_KEY) throw new Error("EXA_API_KEY is not set");
  client ??= new Exa(process.env.EXA_API_KEY);
  return client;
}

export async function scanOffers(
  policy: Policy,
  opts: { query?: string; depth?: ScanDepth } = {},
): Promise<OfferScan> {
  const query =
    opts.query ??
    OFFER_QUERIES[String(policy.kind)] ??
    `${policy.product} insurance monthly rates by company`;
  const res = await exa().search(query, {
    type: opts.depth ?? "deep",
    contents: { highlights: true },
    systemPrompt: SYSTEM_PROMPT,
    outputSchema: OUTPUT_SCHEMA,
  });
  const content = res.output?.content;
  const raw = (typeof content === "string" ? safeParse(content) : content) as {
    offers?: Partial<PublishedOffer>[];
  } | null;
  const offers = dedupe(
    (raw?.offers ?? [])
      .filter(
        (o): o is PublishedOffer =>
          typeof o.monthly === "number" && o.monthly > 0 && isInsurerName(o.insurer) && !!o.url,
      )
      .map((o) => ({ ...o, monthly: Math.round(o.monthly), insurer: o.insurer.trim() })),
  ).sort((a, b) => a.monthly - b.monthly);
  return {
    policyId: policy.id,
    kind: String(policy.kind),
    query,
    offers,
    sources: new Set(offers.map((o) => o.url)).size,
    costDollars: (res as { costDollars?: { total?: number } }).costDollars?.total,
    scannedAt: new Date().toISOString(),
  };
}

export function scanAll(policies: Policy[], depth: ScanDepth = "deep") {
  return Promise.allSettled(policies.map((p) => scanOffers(p, { depth })));
}

// Discounts and promotions on the insurers' own pages (and recent reviews of them).
export interface Campaign {
  insurer: string;
  offer: string;
  percentOff?: number;
  eligibility: string;
  fitsProfile: "yes" | "no" | "unknown";
  endsOn?: string;
  url: string;
}

const CAMPAIGN_SCHEMA = {
  type: "object" as const,
  properties: {
    campaigns: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          insurer: { type: "string" as const },
          offer: { type: "string" as const },
          percentOff: { type: "number" as const },
          eligibility: { type: "string" as const },
          fitsProfile: { type: "string" as const },
          endsOn: { type: "string" as const },
          url: { type: "string" as const },
        },
        required: ["insurer", "offer", "eligibility", "fitsProfile", "url"],
      },
    },
  },
  required: ["campaigns"],
};

// `profile` must hold shareable facts only; it is sent to Exa.
export async function scanCampaigns(
  kind: string,
  insurers: string[],
  profile: string,
): Promise<{ campaigns: Campaign[]; costDollars?: number }> {
  if (!insurers.length) return { campaigns: [] };
  const query = `current ${kind} insurance discounts and promotions from ${insurers.join(", ")}`;
  const res = await exa().search(query, {
    type: "deep",
    contents: { highlights: true },
    systemPrompt: `Extract discounts and promotional offers that an insurer's own page or a recent review explicitly states, one entry per discount, with offer set to the discount's name only (at most 6 words). Record the size as a percent only when the page states it, who is eligible, and an end date only if one is stated. Set fitsProfile to "yes" when this customer clearly qualifies, "no" when they clearly do not, otherwise "unknown". Customer: ${profile}. Omit discounts whose insurer is not named; never estimate a size.`,
    outputSchema: CAMPAIGN_SCHEMA,
  });
  const content = res.output?.content;
  const raw = (typeof content === "string" ? safeParse(content) : content) as {
    campaigns?: Partial<Campaign>[];
  } | null;
  const campaigns = (raw?.campaigns ?? []).filter(
    (c): c is Campaign => isInsurerName(c.insurer) && !!c.offer && !!c.url,
  );
  return {
    campaigns: campaigns.map((c) => ({
      ...c,
      fitsProfile: c.fitsProfile === "yes" || c.fitsProfile === "no" ? c.fitsProfile : "unknown",
      percentOff:
        typeof c.percentOff === "number" && c.percentOff > 0 && c.percentOff < 60
          ? c.percentOff
          : undefined,
    })),
    costDollars: (res as { costDollars?: { total?: number } }).costDollars?.total,
  };
}

// The model sometimes writes "No named insurer" or a sentence where a company name belongs.
export const isInsurerName = (s?: string): s is string =>
  !!s &&
  s.trim().length <= 40 &&
  !/cannot|unknown|not (stated|named|identified)|no named|unnamed|n\/a|various/i.test(s);

// Same insurer, same price, same page is one offer.
function dedupe(offers: PublishedOffer[]) {
  const seen = new Set<string>();
  return offers.filter((o) => {
    const key = `${o.insurer.toLowerCase()}|${o.monthly}|${o.url}`;
    return !seen.has(key) && seen.add(key);
  });
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
