import type { Policy } from "./types";

// Mock self-service portals for the fictional insurers. Each has an online cancel flow:
// pick a reason -> "sad to see you go" retention offer -> type CANCEL to confirm.
// Health and term life have no retention offers: plan prices and locked term rates can't move.

export interface RetentionTerms {
  percentOff: number;
  months: number;
  headline: string;
}

export interface MockInsurer {
  slug: string;
  name: string;
  accent: string;
  retention?: RetentionTerms;
}

export const INSURERS: MockInsurer[] = [
  {
    slug: "northstar-mutual",
    name: "Northstar Mutual",
    accent: "#1d3f72",
    retention: { percentOff: 14, months: 12, headline: "We'd hate to lose a driver like you." },
  },
  { slug: "meridian-health", name: "Meridian Health", accent: "#0f6b5c" },
  {
    slug: "pawsure",
    name: "Pawsure",
    accent: "#b0522a",
    retention: { percentOff: 10, months: 6, headline: "Miso will miss us. Stay and save." },
  },
  { slug: "evergreen-term", name: "Evergreen Term", accent: "#3d5a2a" },
  {
    slug: "hearthly",
    name: "Hearthly",
    accent: "#6b3fa0",
    retention: { percentOff: 12, months: 12, headline: "Sad to see you go." },
  },
];

export const insurerBySlug = (slug: string) => INSURERS.find((i) => i.slug === slug);
export const insurerSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function retentionOffer(policy: Policy, insurer: MockInsurer) {
  const r = insurer.retention;
  if (!r) return null;
  return {
    headline: r.headline,
    percentOff: r.percentOff,
    months: r.months,
    monthly: Math.round(policy.monthlyPremium * (1 - r.percentOff / 100)),
  };
}
