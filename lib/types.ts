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

export interface CoverageItem {
  label: string;
  value: string;
  deductible?: string;
  mustKeep: boolean;
  rule?: string;
}

export interface Coverage {
  summary: string;
  items: CoverageItem[];
  requirements: string[];
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
  coverage?: Coverage;
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
  claimable?: boolean;
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

// One price Maya could pay for a policy. Estimates come from published rates and campaigns;
// obtainable prices were offered to her directly (live quote, retention offer, cancel-flow probe).
export type PriceSource = "published" | "campaign" | "network" | "quote" | "retention";

export interface PriceCandidate {
  id: string;
  policyId: string;
  insurer: string;
  source: PriceSource;
  monthly: number;
  obtainable: boolean;
  basis: string;
  url?: string;
  expiresOn?: string;
  at: string;
}

// Closing a deal over email: confirm terms, release sealed facts by draft, verify the
// contract, Maya signs, the desk binds. Every step is a real AgentMail message.
export type DealStatus = "confirming" | "awaiting_release" | "releasing" | "checking_contract" | "awaiting_signature" | "signing" | "bound" | "declined" | "failed";

export interface DealMail {
  at: string;
  direction: "out" | "in" | "draft";
  from: string;
  to: string;
  subject: string;
  summary: string;
  labels: string[];
  attachment?: string;
  messageId?: string;
}

export interface DealCheck {
  label: string;
  expected: string;
  found: string;
  ok: boolean;
}

export interface Deal {
  id: string;
  ref: string;
  policyId: string;
  callId?: string;
  insurer: string;
  monthly: number;
  previousMonthly: number;
  status: DealStatus;
  note?: string;
  inbox: string;
  desk: string;
  requested: { label: string; masked: string; owner: "person" | "policy" }[];
  draftId?: string;
  releasedAt?: string;
  contract?: { filename: string; sha256: string; version: number; checks: DealCheck[] };
  signature?: { name: string; at: string; mode?: "typed" | "autopilot" };
  receipt?: { id: string; sha256: string; filename: string; policyNumber?: string };
  mails: DealMail[];
  deskSeen?: string[];
  autopilot?: boolean;
  contractPdf?: string;
  receiptPdf?: string;
  policyPdf?: string;
  policyFilename?: string;
  createdAt: string;
  updatedAt: string;
}

export type StoreEvent =
  | { type: "call"; call: Call }
  | { type: "stance"; stance: Stance }
  | { type: "signal"; signal: Signal }
  | { type: "policy"; policy: Policy }
  | { type: "price"; price: PriceCandidate };
