import type { Coverage, Policy } from "./types";

export const COVERAGE: Record<string, Coverage> = {
  "auto-northstar": {
    summary: "Full coverage, 100/300/100 liability, $500 deductibles",
    items: [
      { label: "Bodily injury liability", value: "$100,000 / $300,000", mustKeep: true, rule: "At least $100k per person / $300k per accident" },
      { label: "Property damage liability", value: "$100,000", mustKeep: true, rule: "At least $100k" },
      { label: "Uninsured motorist", value: "$100,000 / $300,000", mustKeep: true, rule: "Match liability limits" },
      { label: "Collision", value: "Actual cash value", deductible: "$500", mustKeep: true, rule: "Deductible up to $1,000 if it saves at least $15/mo" },
      { label: "Comprehensive", value: "Actual cash value", deductible: "$500", mustKeep: true, rule: "Deductible up to $1,000 if it saves at least $15/mo" },
      { label: "Medical payments", value: "$5,000", mustKeep: false },
      { label: "Rental reimbursement", value: "$40/day, 30 days", mustKeep: false },
      { label: "Roadside assistance", value: "Included", mustKeep: false },
    ],
    requirements: [
      "New policy starts on or before Oct 20 so there's no gap",
      "Insurer rated A or better (AM Best)",
      "Same named drivers and vehicle; no mileage cap that she'd exceed",
    ],
  },
  "health-meridian": {
    summary: "Silver PPO, $1,500 deductible, her 3 doctors in network",
    items: [
      { label: "Plan tier", value: "Silver PPO", mustKeep: true, rule: "Silver or better" },
      { label: "Deductible", value: "$1,500", mustKeep: true, rule: "No higher than $2,000" },
      { label: "Out-of-pocket maximum", value: "$8,700", mustKeep: true, rule: "No higher than $9,200" },
      { label: "Doctors in network", value: "All 3 of her doctors", mustKeep: true, rule: "All 3 stay in network" },
      { label: "Primary care visit", value: "$35 copay", mustKeep: false },
      { label: "Generic prescriptions", value: "$15 copay", mustKeep: false },
    ],
    requirements: ["Switch only during open enrollment (from Nov 1)", "Keeps her current prescriptions on formulary"],
  },
  "pet-pawsure": {
    summary: "Accident & illness for Miso, 80% reimbursement",
    items: [
      { label: "Coverage", value: "Accident & illness", mustKeep: true },
      { label: "Annual limit", value: "$10,000", mustKeep: true, rule: "At least $10,000" },
      { label: "Reimbursement", value: "80%", mustKeep: true, rule: "At least 80%" },
      { label: "Deductible", value: "$250 per year", mustKeep: false },
    ],
    requirements: ["No new pre-existing condition exclusions for Miso"],
  },
  "life-evergreen": {
    summary: "20-year level term, $500,000",
    items: [
      { label: "Death benefit", value: "$500,000", mustKeep: true, rule: "At least $500,000" },
      { label: "Term", value: "20 years, level premium", mustKeep: true, rule: "Level premium for 20 years" },
      { label: "Conversion option", value: "Convertible until 65", mustKeep: false },
    ],
    requirements: ["Never cancel before a replacement is approved and in force"],
  },
  "renters-hearthly": {
    summary: "Renters, $30k contents, $100k liability",
    items: [
      { label: "Personal property", value: "$30,000, replacement cost", mustKeep: true, rule: "At least $30k, replacement cost" },
      { label: "Personal liability", value: "$100,000", mustKeep: true, rule: "At least $100k" },
      { label: "Loss of use", value: "$9,000", mustKeep: false },
      { label: "Deductible", value: "$500", mustKeep: false },
    ],
    requirements: ["Covers the Mission Bay apartment address"],
  },
};

export function withCoverage<T extends Policy | undefined>(policy: T): T {
  if (!policy || policy.coverage) return policy;
  const coverage = COVERAGE[policy.id];
  return (coverage ? { ...policy, coverage } : policy) as T;
}

export function coverageLines(policy: Policy) {
  const c = policy.coverage;
  if (!c) return [];
  return [
    ...c.items.map((i) => `${i.label}: ${i.value}${i.deductible ? `, ${i.deductible} deductible` : ""}`),
    ...c.requirements.map((r) => `Requirement: ${r}`),
  ];
}
