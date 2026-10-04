import type { MemberRate, Person, Policy, Signal, Stance, Transaction } from "./types";

export const PERSON_ID = "maya";

export const person: Person = {
  id: PERSON_ID,
  name: "Maya Okafor",
  firstName: "Maya",
  email: "maya.okafor@example.com",
  inbox: "maya.lowball@agentmail.to",
  city: "San Francisco",
  state: "CA",
  birthYear: 1997,
  facts: [
    { label: "Age", value: "29", disclosure: "shareable" },
    { label: "Driving record", value: "Clean, no claims since 2019", disclosure: "shareable" },
    { label: "Date of birth", value: "1997-03-14", disclosure: "hidden" },
    { label: "Driver's licence", value: "D4417820", disclosure: "hidden" },
    { label: "Salary", value: "$118,000/yr", disclosure: "private" },
  ],
};

export const policies: Policy[] = [
  {
    id: "auto-northstar",
    personId: PERSON_ID,
    kind: "auto",
    insurer: "Northstar Mutual",
    product: "Full coverage · 2019 Honda Civic",
    monthlyPremium: 248,
    renewsOn: "2026-10-20",
    memberSince: 2019,
    facts: [
      { label: "Vehicle", value: "2019 Honda Civic LX", disclosure: "shareable" },
      { label: "Deductible", value: "$500", disclosure: "shareable" },
      { label: "Annual mileage on file", value: "12,000", disclosure: "shareable" },
      { label: "Liability limits", value: "100/300/100", disclosure: "shareable" },
      { label: "Claims", value: "None since 2019", disclosure: "shareable" },
    ],
  },
  {
    id: "health-meridian",
    personId: PERSON_ID,
    kind: "health",
    insurer: "Meridian Health",
    product: "Silver PPO · Covered California",
    monthlyPremium: 642,
    renewsOn: "2027-01-01",
    memberSince: 2023,
    facts: [
      { label: "Deductible", value: "$1,500", disclosure: "shareable" },
      { label: "Doctors in network", value: "3", disclosure: "shareable" },
    ],
  },
  {
    id: "pet-pawsure",
    personId: PERSON_ID,
    kind: "pet",
    insurer: "Pawsure",
    product: "Accident & illness · Miso (cat)",
    monthlyPremium: 22,
    renewsOn: "2027-03-01",
    memberSince: 2024,
    facts: [{ label: "Deductible", value: "$250", disclosure: "shareable" }],
  },
  {
    id: "life-evergreen",
    personId: PERSON_ID,
    kind: "life",
    insurer: "Evergreen Term",
    product: "20-year term · $500k",
    monthlyPremium: 24,
    renewsOn: "2045-06-01",
    memberSince: 2025,
    facts: [{ label: "Coverage", value: "$500,000", disclosure: "shareable" }],
  },
  {
    id: "renters-hearthly",
    personId: PERSON_ID,
    kind: "renters",
    insurer: "Hearthly",
    product: "Renters · $30k contents",
    monthlyPremium: 18,
    renewsOn: "2027-02-01",
    memberSince: 2022,
    facts: [{ label: "Contents cover", value: "$30,000", disclosure: "shareable" }],
  },
];

export const stances: Stance[] = [
  {
    policyId: "auto-northstar",
    verdict: "overpaying",
    fairMonthly: 178,
    walkAwayMonthly: 198,
    headline: "Overpaying about $70 a month.",
    detail:
      "Drivers with your profile pay $172–$198 at Northstar, GEICO publishes $138 for clean-record drivers in San Francisco, and you've been driving far less since August. Worth a call before the Oct 20 renewal.",
    activity: "calling before renewal",
    updatedAt: "2026-10-04T08:00:00Z",
  },
  {
    policyId: "health-meridian",
    verdict: "waiting",
    fairMonthly: 595,
    headline: "About $47 a month above the cheapest Silver plan.",
    detail:
      "Silver plans for a 29-year-old in San Francisco run $595–$746 without a subsidy. Plan prices are fixed, so there's nothing to haggle; I'll switch you at open enrollment on Nov 1 to the cheapest one with your doctors.",
    activity: "waiting for Nov 1",
    updatedAt: "2026-10-02T08:00:00Z",
  },
  {
    policyId: "pet-pawsure",
    verdict: "won",
    fairMonthly: 22,
    headline: "Won $9 a month off in September.",
    detail: "Pawsure confirmed by email. Nothing left to push on.",
    activity: "won $9 off in September",
    updatedAt: "2026-09-29T08:00:00Z",
  },
  {
    policyId: "life-evergreen",
    verdict: "fair",
    fairMonthly: 24,
    headline: "Fair for a 20-year term at 29.",
    detail: "New buyers pay about $15–$21 for the same cover, but your rate is locked for 20 years and switching means new medical underwriting. Not worth it for a few dollars.",
    activity: "",
    updatedAt: "2026-10-01T08:00:00Z",
  },
  {
    policyId: "renters-hearthly",
    verdict: "fair",
    fairMonthly: 18,
    headline: "Fair.",
    detail: "Published rates for $30k of contents in San Francisco run $14–$35. You're near the bottom. Leaving it alone.",
    activity: "",
    updatedAt: "2026-09-20T08:00:00Z",
  },
];

export const signals: Signal[] = [
  {
    id: "sig-health-policy",
    personId: PERSON_ID,
    policyId: "health-meridian",
    at: "2026-09-09",
    source: "email",
    title: "Read your policy: $1,500 deductible, 3 doctors in network.",
  },
  {
    id: "sig-pet-won",
    personId: PERSON_ID,
    policyId: "pet-pawsure",
    at: "2026-09-29",
    source: "call",
    title: "Pawsure agreed to $22/mo, down from $31. Confirmed by email.",
    impactMonthly: -9,
  },
  {
    id: "sig-auto-policy",
    personId: PERSON_ID,
    policyId: "auto-northstar",
    at: "2026-09-06",
    source: "email",
    title: "Read your renewal notice: $248/mo from Oct 20, 12,000 miles a year on file.",
  },
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function buildTransactions(): Transaction[] {
  const r = rng(42);
  const out: Transaction[] = [];
  const start = new Date("2026-07-06T12:00:00Z");
  const end = new Date("2026-10-03T12:00:00Z");
  let n = 0;
  const push = (date: Date, amount: number, merchant: string, category: Transaction["category"]) =>
    out.push({ id: `tx-${++n}`, personId: PERSON_ID, date: iso(date), amount: Math.round(amount * 100) / 100, merchant, category });

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = new Date(d);
    const dow = day.getUTCDay();
    const dom = day.getUTCDate();
    const wfh = day >= new Date("2026-08-10T00:00:00Z");

    if (dow === 5 && Math.round((day.getTime() - new Date("2026-07-10T12:00:00Z").getTime()) / 86400000) % 14 === 0) {
      push(day, day >= new Date("2026-09-15T00:00:00Z") ? 4540 : 3850, "Halcyon Labs payroll", "payroll");
    }
    if (dom === 1) push(day, -2650, "Mission Bay Apartments", "rent");
    if (dom === 20) push(day, -248, "Northstar Mutual", "insurance");
    if (dom === 1) push(day, -642, "Meridian Health", "insurance");
    if (dom === 5) push(day, day >= new Date("2026-09-01T00:00:00Z") ? -22 : -31, "Pawsure", "insurance");
    if (dom === 12) push(day, -24, "Evergreen Term", "insurance");
    if (dom === 3) push(day, -18, "Hearthly", "insurance");

    if (!wfh && (dow === 1 || dow === 4)) push(day, -(21 + r() * 9), r() > 0.5 ? "Shell" : "Chevron", "gas");
    if (wfh && dom % 19 === 0) push(day, -(31 + r() * 8), "Chevron", "gas");

    if (dow === 0) push(day, -(62 + r() * 40), r() > 0.5 ? "Rainbow Grocery" : "Trader Joe's", "groceries");
    if (r() > 0.72) push(day, -(14 + r() * 48), ["Tartine", "Souvla", "Nopalito", "Blue Bottle", "Zuni Café"][Math.floor(r() * 5)], "dining");
  }
  return out;
}

export const transactions: Transaction[] = buildTransactions();

export const NORTHSTAR_PROFILE = "29 · San Francisco · clean record · 2019 Civic · full coverage";

export function buildMemberRates(): MemberRate[] {
  const r = rng(7);
  const out: MemberRate[] = [];
  let n = 0;
  const add = (insurer: string, kind: string, profile: string, min: number, max: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const v = min + (max - min) * (i === 0 ? 0 : i === count - 1 ? 1 : r());
      out.push({ id: `mr-${++n}`, insurer, kind, profile, monthly: Math.round(v) });
    }
  };
  add("Northstar Mutual", "auto", NORTHSTAR_PROFILE, 172, 198, 14);
  add("Bayline Auto", "auto", NORTHSTAR_PROFILE, 158, 184, 9);
  add("Meridian Health", "health", "29 · San Francisco · silver PPO", 595, 655, 12);
  add("Pawsure", "pet", "1 cat · accident & illness", 19, 26, 8);
  add("Hearthly", "renters", "San Francisco · $30k contents", 16, 21, 10);
  add("Evergreen Term", "life", "29 · non-smoker · 20yr $500k", 22, 27, 6);
  return out;
}

export const memberRates: MemberRate[] = buildMemberRates();
