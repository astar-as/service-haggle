export type Disclosure = "hidden" | "private" | "shareable";

export type PolicyKind = "auto" | "health" | "renters" | "pet" | "life" | (string & {});

export type Verdict = "overpaying" | "fair" | "won" | "negotiating" | "waiting";

export type SignalSource = "exa" | "kernel" | "bank" | "network" | "email" | "call";

export interface Fact {
  label: string;
  value: string;
  disclosure: Disclosure;
}

export interface Person {
  id: string;
  name: string;
  firstName: string;
  email: string;
  inbox: string;
  city: string;
  state: string;
  birthYear: number;
  facts: Fact[];
}

export interface Policy {
  id: string;
  personId: string;
  kind: PolicyKind;
  insurer: string;
  product: string;
  monthlyPremium: number;
  renewsOn: string;
  memberSince: number;
  phone?: string;
  facts: Fact[];
}

export interface Stance {
  policyId: string;
  verdict: Verdict;
  fairMonthly: number;
  walkAwayMonthly?: number;
  headline: string;
  detail: string;
  activity: string;
  updatedAt: string;
}

export interface Signal {
  id: string;
  personId: string;
  policyId?: string;
  at: string;
  source: SignalSource;
  title: string;
  url?: string;
  impactMonthly?: number;
}

export interface Transaction {
  id: string;
  personId: string;
  date: string;
  amount: number;
  merchant: string;
  category: "payroll" | "gas" | "transit" | "rent" | "insurance" | "groceries" | "dining" | "other";
}

export interface MemberRate {
  id: string;
  insurer: string;
  kind: PolicyKind;
  profile: string;
  monthly: number;
}

export interface Turn {
  id: string;
  speaker: "agent" | "counterpart";
  text: string;
  at: string;
  final: boolean;
}

export interface Call {
  id: string;
  policyId: string;
  status: "dialing" | "live" | "ended";
  channel: "browser" | "phone" | "email";
  target?: string;
  machineId?: string;
  roundId?: string;
  insurer: string;
  role: "retention" | "quote";
  counterpart: string;
  startedAt: string;
  endedAt?: string;
  theirOffer?: number;
  ask?: number;
  agreedMonthly?: number;
  citing: string[];
  transcript: Turn[];
}

export type StoreEvent =
  | { type: "call"; call: Call }
  | { type: "stance"; stance: Stance }
  | { type: "signal"; signal: Signal }
  | { type: "policy"; policy: Policy };
