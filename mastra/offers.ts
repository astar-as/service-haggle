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
  "Extract premiums that a page explicitly states for a named insurance company. Convert annual figures to monthly by dividing by 12 and round to whole dollars. For each price, record the profile and coverage the page says the rate applies to (age, location, coverage level). Omit any price that is not attributed to a named insurer or cannot be quoted from the page; never estimate.";

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
          typeof o.monthly === "number" && o.monthly > 0 && !!o.insurer && !!o.url,
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
