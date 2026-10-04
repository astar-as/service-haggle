import type { Disclosure, Person, Policy } from "./types";

// Maya's profile, grouped by the part of life each insurance prices, plus a what-if estimator.
// Pure module (no store), so the profile page can recompute estimates in the browser.
// Every field maps to a Fact on the person or on one policy, found by its label.

export type FieldType = "number" | "select";

export interface ProfileField {
  id: string;
  label: string;
  owner: "person" | string; // "person" or a policy id
  fact: string; // Fact label
  type: FieldType;
  options?: string[];
  prefix?: string;
  suffix?: string;
  fallback: string;
  disclosure: Disclosure;
  hint?: string;
}

export interface ProfileDomain {
  id: string;
  title: string;
  policyId?: string;
  fields: ProfileField[];
}

export const DOMAINS: ProfileDomain[] = [
  {
    id: "you",
    title: "You",
    fields: [
      {
        id: "age",
        label: "Age",
        owner: "person",
        fact: "Age",
        type: "number",
        fallback: "29",
        disclosure: "shareable",
        hint: "Prices health and life",
      },
      {
        id: "city",
        label: "Lives in",
        owner: "person",
        fact: "City",
        type: "select",
        options: ["San Francisco", "Oakland", "San Jose", "Sacramento", "Los Angeles"],
        fallback: "San Francisco",
        disclosure: "shareable",
        hint: "Prices auto and renters",
      },
      {
        id: "salary",
        label: "Salary",
        owner: "person",
        fact: "Salary",
        type: "number",
        prefix: "$",
        suffix: "/yr",
        fallback: "118000",
        disclosure: "private",
        hint: "Never shared; decides subsidy eligibility",
      },
    ],
  },
  {
    id: "driving",
    title: "Driving",
    policyId: "auto-northstar",
    fields: [
      {
        id: "mileage",
        label: "Annual mileage",
        owner: "auto-northstar",
        fact: "Annual mileage on file",
        type: "number",
        suffix: " mi",
        fallback: "12000",
        disclosure: "shareable",
        hint: "A mandatory rating factor in California",
      },
      {
        id: "autoDeductible",
        label: "Collision deductible",
        owner: "auto-northstar",
        fact: "Deductible",
        type: "select",
        options: ["$250", "$500", "$1,000", "$2,000"],
        fallback: "$500",
        disclosure: "shareable",
      },
      {
        id: "liability",
        label: "Liability limits",
        owner: "auto-northstar",
        fact: "Liability limits",
        type: "select",
        options: ["30/60/15", "50/100/50", "100/300/100", "250/500/100"],
        fallback: "100/300/100",
        disclosure: "shareable",
      },
      {
        id: "claims",
        label: "Claims",
        owner: "auto-northstar",
        fact: "Claims",
        type: "select",
        options: ["None since 2019", "1 at-fault in 3 years", "2+ at-fault in 3 years"],
        fallback: "None since 2019",
        disclosure: "shareable",
      },
      {
        id: "parking",
        label: "Parks at night",
        owner: "auto-northstar",
        fact: "Parking",
        type: "select",
        options: ["Street", "Driveway", "Garage"],
        fallback: "Street",
        disclosure: "shareable",
      },
    ],
  },
  {
    id: "health",
    title: "Health",
    policyId: "health-meridian",
    fields: [
      {
        id: "tier",
        label: "Metal tier",
        owner: "health-meridian",
        fact: "Metal tier",
        type: "select",
        options: ["Bronze", "Silver", "Gold", "Platinum"],
        fallback: "Silver",
        disclosure: "shareable",
        hint: "Switchable at open enrollment",
      },
      {
        id: "doctors",
        label: "Doctors in network",
        owner: "health-meridian",
        fact: "Doctors in network",
        type: "number",
        fallback: "3",
        disclosure: "shareable",
      },
    ],
  },
  {
    id: "home",
    title: "Home",
    policyId: "renters-hearthly",
    fields: [
      {
        id: "contents",
        label: "Contents cover",
        owner: "renters-hearthly",
        fact: "Contents cover",
        type: "number",
        prefix: "$",
        fallback: "30000",
        disclosure: "shareable",
      },
      {
        id: "rentersDeductible",
        label: "Deductible",
        owner: "renters-hearthly",
        fact: "Deductible",
        type: "select",
        options: ["$250", "$500", "$1,000"],
        fallback: "$500",
        disclosure: "shareable",
      },
    ],
  },
  {
    id: "pet",
    title: "Miso",
    policyId: "pet-pawsure",
    fields: [
      {
        id: "petAge",
        label: "Age",
        owner: "pet-pawsure",
        fact: "Pet age",
        type: "number",
        suffix: " yrs",
        fallback: "4",
        disclosure: "shareable",
      },
      {
        id: "petDeductible",
        label: "Deductible",
        owner: "pet-pawsure",
        fact: "Deductible",
        type: "select",
        options: ["$100", "$250", "$500"],
        fallback: "$250",
        disclosure: "shareable",
      },
    ],
  },
  {
    id: "life",
    title: "Life",
    policyId: "life-evergreen",
    fields: [
      {
        id: "coverage",
        label: "Coverage",
        owner: "life-evergreen",
        fact: "Coverage",
        type: "number",
        prefix: "$",
        fallback: "500000",
        disclosure: "shareable",
      },
      {
        id: "tobacco",
        label: "Tobacco",
        owner: "life-evergreen",
        fact: "Tobacco",
        type: "select",
        options: ["No", "Yes"],
        fallback: "No",
        disclosure: "shareable",
        hint: "Locked in at purchase; matters if you re-shop",
      },
    ],
  },
];

export const FIELDS = DOMAINS.flatMap((d) => d.fields);
export type Values = Record<string, string>;

export const num = (v: string) => Number(String(v).replace(/[^0-9.]/g, "")) || 0;

export function readValues(person: Person, policies: Policy[]): Values {
  const out: Values = {};
  for (const f of FIELDS) {
    const facts =
      f.owner === "person" ? person.facts : policies.find((p) => p.id === f.owner)?.facts;
    const hit = facts?.find((x) => x.label === f.fact)?.value;
    out[f.id] = f.id === "city" ? (hit ?? person.city) : (hit ?? f.fallback);
    if (f.type === "number") out[f.id] = String(num(out[f.id]));
  }
  return out;
}

export function formatValue(f: ProfileField, v: string) {
  if (f.type !== "number") return v;
  return `${f.prefix ?? ""}${num(v).toLocaleString("en-US")}${f.suffix ?? ""}`;
}

// ---- What-if estimator -------------------------------------------------------------------
// Rough rating-factor relativities, not quotes. Each factor compares the new value to the
// current one, so the estimate moves the current premium by the ratio.

const pick = (table: Record<string, number>, v: string) => table[v] ?? 1;
const AUTO_DEDUCTIBLE = { $250: 1.08, $500: 1, "$1,000": 0.88, "$2,000": 0.8 };
const LIABILITY = { "30/60/15": 0.82, "50/100/50": 0.9, "100/300/100": 1, "250/500/100": 1.12 };
const CLAIMS = {
  "None since 2019": 1,
  "1 at-fault in 3 years": 1.42,
  "2+ at-fault in 3 years": 2.05,
};
const PARKING = { Street: 1, Driveway: 0.97, Garage: 0.95 };
const CITY_AUTO = {
  "San Francisco": 1,
  Oakland: 1.06,
  "San Jose": 0.86,
  Sacramento: 0.83,
  "Los Angeles": 1.12,
};
const CITY_RENTERS = {
  "San Francisco": 1,
  Oakland: 1.1,
  "San Jose": 0.9,
  Sacramento: 0.85,
  "Los Angeles": 1.08,
};
const TIER = { Bronze: 0.79, Silver: 1, Gold: 1.17, Platinum: 1.36 };
const RENTERS_DEDUCTIBLE = { $250: 1.1, $500: 1, "$1,000": 0.88 };
const PET_DEDUCTIBLE = { $100: 1.22, $250: 1, $500: 0.84 };
const TOBACCO = { No: 1, Yes: 2.9 };

// Federal default ACA age curve (California uses the same shape): premium relative to age 21.
const ACA_AGE: [number, number][] = [
  [21, 1],
  [25, 1.004],
  [30, 1.135],
  [35, 1.222],
  [40, 1.278],
  [45, 1.444],
  [50, 1.786],
  [55, 2.23],
  [60, 2.714],
  [64, 3],
];
function acaAge(age: number) {
  const a = Math.min(64, Math.max(21, age));
  for (let i = 1; i < ACA_AGE.length; i++) {
    const [x1, y1] = ACA_AGE[i - 1];
    const [x2, y2] = ACA_AGE[i];
    if (a <= x2) return y1 + ((y2 - y1) * (a - x1)) / (x2 - x1);
  }
  return 3;
}
// Term life roughly doubles every ~8 years of issue age around 30.
const lifeAge = (age: number) => Math.pow(2, (age - 29) / 8);
const autoAge = (age: number) => (age < 21 ? 1.9 : age < 25 ? 1.35 : age < 70 ? 1 : 1.15);
const mileage = (mi: number) => Math.min(1.25, Math.max(0.8, 0.78 + 0.22 * (mi / 12000)));
const contents = (usd: number) => 0.45 + 0.55 * (usd / 30000);
const coverage = (usd: number) => 0.2 + 0.8 * (usd / 500000);
const petAge = (yrs: number) => 1 + 0.08 * (yrs - 4);

interface Factor {
  policyKind: string;
  field: string;
  label: (from: string, to: string) => string;
  ratio: (from: Values, to: Values) => number;
}

const FACTORS: Factor[] = [
  {
    policyKind: "auto",
    field: "mileage",
    label: (a, b) => `Mileage ${num(a).toLocaleString("en-US")} → ${num(b).toLocaleString("en-US")} mi`,
    ratio: (a, b) => mileage(num(b.mileage)) / mileage(num(a.mileage)),
  },
  {
    policyKind: "auto",
    field: "autoDeductible",
    label: (a, b) => `Deductible ${a} → ${b}`,
    ratio: (a, b) =>
      pick(AUTO_DEDUCTIBLE, b.autoDeductible) / pick(AUTO_DEDUCTIBLE, a.autoDeductible),
  },
  {
    policyKind: "auto",
    field: "liability",
    label: (a, b) => `Liability ${a} → ${b}`,
    ratio: (a, b) => pick(LIABILITY, b.liability) / pick(LIABILITY, a.liability),
  },
  {
    policyKind: "auto",
    field: "claims",
    label: (_, b) => `Claims: ${b}`,
    ratio: (a, b) => pick(CLAIMS, b.claims) / pick(CLAIMS, a.claims),
  },
  {
    policyKind: "auto",
    field: "parking",
    label: (a, b) => `Parking ${a} → ${b}`,
    ratio: (a, b) => pick(PARKING, b.parking) / pick(PARKING, a.parking),
  },
  {
    policyKind: "auto",
    field: "city",
    label: (a, b) => `${a} → ${b}`,
    ratio: (a, b) => pick(CITY_AUTO, b.city) / pick(CITY_AUTO, a.city),
  },
  {
    policyKind: "auto",
    field: "age",
    label: (a, b) => `Age ${a} → ${b}`,
    ratio: (a, b) => autoAge(num(b.age)) / autoAge(num(a.age)),
  },
  {
    policyKind: "health",
    field: "tier",
    label: (a, b) => `${a} → ${b}`,
    ratio: (a, b) => pick(TIER, b.tier) / pick(TIER, a.tier),
  },
  {
    policyKind: "health",
    field: "age",
    label: (a, b) => `Age ${a} → ${b} (ACA age curve)`,
    ratio: (a, b) => acaAge(num(b.age)) / acaAge(num(a.age)),
  },
  {
    policyKind: "renters",
    field: "contents",
    label: (a, b) => `Contents $${num(a).toLocaleString("en-US")} → $${num(b).toLocaleString("en-US")}`,
    ratio: (a, b) => contents(num(b.contents)) / contents(num(a.contents)),
  },
  {
    policyKind: "renters",
    field: "rentersDeductible",
    label: (a, b) => `Deductible ${a} → ${b}`,
    ratio: (a, b) =>
      pick(RENTERS_DEDUCTIBLE, b.rentersDeductible) / pick(RENTERS_DEDUCTIBLE, a.rentersDeductible),
  },
  {
    policyKind: "renters",
    field: "city",
    label: (a, b) => `${a} → ${b}`,
    ratio: (a, b) => pick(CITY_RENTERS, b.city) / pick(CITY_RENTERS, a.city),
  },
  {
    policyKind: "pet",
    field: "petAge",
    label: (a, b) => `Miso ${a} → ${b} yrs`,
    ratio: (a, b) => petAge(num(b.petAge)) / petAge(num(a.petAge)),
  },
  {
    policyKind: "pet",
    field: "petDeductible",
    label: (a, b) => `Deductible ${a} → ${b}`,
    ratio: (a, b) => pick(PET_DEDUCTIBLE, b.petDeductible) / pick(PET_DEDUCTIBLE, a.petDeductible),
  },
  {
    policyKind: "life",
    field: "coverage",
    label: (a, b) => `Coverage $${num(a).toLocaleString("en-US")} → $${num(b).toLocaleString("en-US")}`,
    ratio: (a, b) => coverage(num(b.coverage)) / coverage(num(a.coverage)),
  },
  {
    policyKind: "life",
    field: "tobacco",
    label: (_, b) => `Tobacco: ${b}`,
    ratio: (a, b) => pick(TOBACCO, b.tobacco) / pick(TOBACCO, a.tobacco),
  },
  {
    policyKind: "life",
    field: "age",
    label: (a, b) => `Age ${a} → ${b} if you re-shop`,
    ratio: (a, b) => lifeAge(num(b.age)) / lifeAge(num(a.age)),
  },
];

export interface PolicyEstimate {
  policyId: string;
  kind: string;
  insurer: string;
  from: number;
  to: number;
  fairFrom?: number;
  fairTo?: number;
  reasons: { label: string; pct: number }[];
}

export function estimate(
  policies: Policy[],
  fair: Record<string, number>,
  base: Values,
  next: Values,
): PolicyEstimate[] {
  return policies.map((p) => {
    const reasons: PolicyEstimate["reasons"] = [];
    let ratio = 1;
    for (const f of FACTORS) {
      if (f.policyKind !== p.kind || base[f.field] === next[f.field]) continue;
      const r = f.ratio(base, next);
      if (!Number.isFinite(r) || Math.abs(r - 1) < 0.005) continue;
      ratio *= r;
      reasons.push({
        label: f.label(base[f.field], next[f.field]),
        pct: Math.round((r - 1) * 100),
      });
    }
    return {
      policyId: p.id,
      kind: String(p.kind),
      insurer: p.insurer,
      from: p.monthlyPremium,
      to: Math.round(p.monthlyPremium * ratio),
      fairFrom: fair[p.id],
      fairTo: fair[p.id] !== undefined ? Math.round(fair[p.id] * ratio) : undefined,
      reasons,
    };
  });
}

// Apply edited values back onto facts. Returns only the records that changed.
export function applyValues(person: Person, policies: Policy[], values: Values) {
  const setFact = (facts: Person["facts"], f: ProfileField, value: string) => {
    const shown = formatValue(f, value);
    const i = facts.findIndex((x) => x.label === f.fact);
    if (i >= 0) {
      if (facts[i].value === shown) return false;
      facts[i] = { ...facts[i], value: shown };
    } else facts.push({ label: f.fact, value: shown, disclosure: f.disclosure });
    return true;
  };
  const nextPerson = structuredClone(person);
  const nextPolicies = structuredClone(policies);
  let personChanged = false;
  const changedPolicies = new Set<string>();
  for (const f of FIELDS) {
    const v = values[f.id];
    if (v === undefined) continue;
    if (f.owner === "person") {
      if (f.id === "city") {
        if (nextPerson.city !== v) {
          nextPerson.city = v;
          personChanged = true;
        }
        continue;
      }
      personChanged = setFact(nextPerson.facts, f, v) || personChanged;
    } else {
      const p = nextPolicies.find((x) => x.id === f.owner);
      if (p && setFact(p.facts, f, v)) changedPolicies.add(p.id);
    }
  }
  return {
    person: personChanged ? nextPerson : undefined,
    policies: nextPolicies.filter((p) => changedPolicies.has(p.id)),
  };
}
