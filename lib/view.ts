import type { Call, Policy, Signal, SignalSource, Stance } from "./types";

export const KIND_LABEL: Record<string, string> = {
  auto: "Auto",
  health: "Health",
  pet: "Pet",
  life: "Life",
  renters: "Renters",
};

export const SOURCE_LABEL: Record<SignalSource, string> = {
  exa: "Exa",
  kernel: "Kernel",
  bank: "Bank data",
  network: "Lowball network",
  email: "Email",
  call: "Call",
};

export const kindLabel = (kind: string) => KIND_LABEL[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1);

export const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function shortDate(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export interface Row {
  policy: Policy;
  stance?: Stance;
  gap: number;
  live: boolean;
  callId?: string;
}

export function buildRows(policies: Policy[], stances: Stance[], calls: Call[] = []) {
  const byId = new Map(stances.map((s) => [s.policyId, s]));
  const rows: Row[] = policies.map((policy) => {
    const stance = byId.get(policy.id);
    const call = calls.find((c) => c.status !== "ended" && c.policyId === policy.id);
    const open = stance && ["overpaying", "waiting", "negotiating"].includes(stance.verdict);
    const gap = open && stance ? Math.max(0, policy.monthlyPremium - stance.fairMonthly) : 0;
    return { policy, stance, gap, live: !!call, callId: call?.id };
  });
  const needs = rows.filter((r) => r.gap > 0 || r.live).sort((a, b) => Number(b.live) - Number(a.live) || b.gap - a.gap);
  const fair = rows.filter((r) => !(r.gap > 0 || r.live)).sort((a, b) => b.policy.monthlyPremium - a.policy.monthlyPremium);
  const pays = policies.reduce((s, p) => s + p.monthlyPremium, 0);
  const tooMuch = needs.reduce((s, r) => s + r.gap, 0);
  return { needs, fair, pays, tooMuch };
}

export function subtitle(row: Row) {
  if (row.live) return "on the phone now";
  return row.stance?.activity || "";
}

export function signalLabel(s: Signal) {
  return SOURCE_LABEL[s.source] ?? s.source;
}
