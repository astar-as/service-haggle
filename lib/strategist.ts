import { coverageLines } from "./coverage";
import { competingOffers } from "./agents";
import { brokerEmailFor, sendConfirmation } from "./mail";
import { generateLine, hasModel } from "./models";
import {
  computeAnchors,
  detectLifeEvents,
  networkStats,
  REFERENCE_FACTS,
  type NetworkStats,
} from "./monitor";
import { priceBoard } from "./pricing";
import { store } from "./store";
import type { Call, Person, Policy, Stance, Turn } from "./types";

export interface DelegationRequest {
  callId: string;
  policyId: string;
  request: string;
  transcript: Turn[];
}

export interface DelegationResult {
  say: string;
  theirOffer?: number;
  ask?: number;
  agreedMonthly?: number;
  citing?: string[];
  endCall?: boolean;
}

export interface Evidence {
  kind: "network" | "bank" | "exa" | "reference" | "offer";
  label: string;
  say: string;
  url?: string;
}

export interface Brief {
  policy: Policy;
  person: Person;
  stance?: Stance;
  premium: number;
  fair: number;
  walkAway: number;
  net: NetworkStats | null;
  evidence: Evidence[];
  shareable: string[];
  builtAt: number;
}

export type Role = "retention" | "quote";

export interface Leverage {
  callId?: string;
  insurer: string;
  monthly: number;
  live: boolean;
  agreed: boolean;
}

export type Action = "open" | "request_quote" | "counter" | "accept" | "close" | "wrap_up" | "walk";

export interface Plan {
  action: Action;
  ask?: number;
  agreed?: number;
  leverage?: Leverage;
  endCall: boolean;
  reason: string;
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "web";
  }
};

const BRIEF_TTL_MS = 60_000;
const briefs = new Map<string, { at: number; brief: Promise<Brief> }>();

export function invalidateBrief(policyId?: string) {
  if (policyId) briefs.delete(policyId);
  else briefs.clear();
}

async function buildBrief(policyId: string): Promise<Brief> {
  const [policy, person, stance, transactions, signals] = await Promise.all([
    store.policy(policyId),
    store.person(),
    store.stance(policyId),
    store.transactions(),
    store.signals(policyId),
  ]);
  if (!policy) throw new Error(`Unknown policy ${policyId}`);
  const net = await networkStats(policy);
  const computed = computeAnchors(policy, net, stance);
  const fair =
    stance?.fairMonthly && stance.fairMonthly < policy.monthlyPremium
      ? stance.fairMonthly
      : computed.fair;
  const walkAway = Math.max(
    fair,
    Math.min(stance?.walkAwayMonthly ?? computed.walkAway, policy.monthlyPremium),
  );
  const who = policy.kind === "auto" ? "drivers" : "members";
  const evidence: Evidence[] = [];
  if (net) {
    evidence.push({
      kind: "network",
      label: `${net.count} ${who} like ${person.firstName} · Service Haggle network`,
      say: `${net.count} people with ${person.firstName}'s profile pay ${usd(net.min)} to ${usd(net.max)} a month at ${net.insurer}`,
    });
  }
  // Cheapest published rates and campaigns from other insurers, from the price ledger.
  const board = await priceBoard(policyId).catch(() => null);
  const cheaper = (board?.candidates ?? []).filter(
    (c) =>
      !c.obtainable &&
      c.source !== "network" &&
      c.insurer !== policy.insurer &&
      c.monthly < policy.monthlyPremium,
  );
  for (const c of cheaper.slice(0, 2)) {
    evidence.push({
      kind: "exa",
      label: `${c.insurer} ${usd(c.monthly)} · ${c.source === "campaign" ? "campaign" : "published rate"}`,
      say:
        c.source === "campaign"
          ? `${c.insurer} is advertising ${c.basis.split(",")[0]}, which brings their published rate to about ${usd(c.monthly)} a month`
          : `${c.insurer} publishes ${usd(c.monthly)} a month for ${c.basis.split(" · ")[0]}`,
      url: c.url,
    });
  }
  for (const e of detectLifeEvents(transactions)) {
    if (e.disclosure !== "shareable" || !e.shareable || !e.kinds.includes(String(policy.kind)))
      continue;
    evidence.push({
      kind: "bank",
      label: `Driving less since ${shortDate(e.since).split(" ")[0]} · bank data`,
      say: `${e.shareable}, so the mileage on file is out of date`,
    });
  }
  for (const s of signals
    .filter((x) => x.source === "exa" && x.url && !x.id.startsWith("sig-price-"))
    .slice(0, 2)) {
    const title = s.title.replace(/^[a-z0-9.-]+\.[a-z]{2,}:\s*/i, "");
    evidence.push({
      kind: "exa",
      label: `${title.length > 48 ? `${title.slice(0, 45)}…` : title} · Exa`,
      say: title,
      url: s.url,
    });
  }
  for (const r of REFERENCE_FACTS.filter((x) => x.kind === String(policy.kind))) {
    evidence.push({ kind: "reference", label: r.label, say: r.say, url: r.url });
  }
  const shareable = [
    ...person.facts
      .filter((f) => f.disclosure === "shareable")
      .map((f) => `${f.label}: ${f.value}`),
    ...policy.facts
      .filter((f) => f.disclosure === "shareable")
      .map((f) => `${f.label}: ${f.value}`),
    ...coverageLines(policy),
    `Product: ${policy.product}`,
    `Current premium: ${usd(policy.monthlyPremium)} a month`,
    `Renews: ${shortDate(policy.renewsOn)}`,
    `Customer since: ${policy.memberSince}`,
  ];
  return {
    policy,
    person,
    stance,
    premium: policy.monthlyPremium,
    fair,
    walkAway,
    net,
    evidence,
    shareable,
    builtAt: Date.now(),
  };
}

export function getBrief(policyId: string): Promise<Brief> {
  const hit = briefs.get(policyId);
  if (hit && Date.now() - hit.at < BRIEF_TTL_MS) return hit.brief;
  const brief = buildBrief(policyId);
  briefs.set(policyId, { at: Date.now(), brief });
  brief.catch(() => briefs.delete(policyId));
  return brief;
}

export const prepareCall = (policyId: string) => getBrief(policyId).then(() => undefined);

export function ladder(brief: Brief, insurer?: string) {
  const own = brief.net?.market.insurers.find((i) => i.insurer === insurer);
  const floor = own?.min ?? brief.net?.min ?? Math.round(brief.fair * 0.93);
  const open = Math.round((Math.min(floor, brief.fair) + brief.fair) / 2);
  const mid = Math.round((brief.fair + brief.walkAway) / 2);
  return [...new Set([open, brief.fair, mid])].sort((a, b) => a - b);
}

const NUM_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const UNIT: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const TEEN: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const U = Object.keys(UNIT).join("|");

// How prices are said out loud: "two twenty", "one eighty-five", "one oh five", "one fifteen".
function spokenPrices(text: string) {
  return text
    .replace(
      new RegExp(
        `\\b(${U})[\\s-]+(${Object.keys(TENS).join("|")})(?:[\\s-]+(${U}))?\\b(?![\\s-]+(hundred|thousand))`,
        "gi",
      ),
      (_m, h: string, t: string, u?: string) =>
        String(
          UNIT[h.toLowerCase()] * 100 + TENS[t.toLowerCase()] + (u ? UNIT[u.toLowerCase()] : 0),
        ),
    )
    .replace(
      new RegExp(
        `\\b(${U})[\\s-]+(${Object.keys(TEEN).join("|")})\\b(?![\\s-]+(hundred|thousand))`,
        "gi",
      ),
      (_m, h: string, t: string) => String(UNIT[h.toLowerCase()] * 100 + TEEN[t.toLowerCase()]),
    )
    .replace(
      new RegExp(`\\b(${U})[\\s-]+(?:oh|o)[\\s-]+(${U})\\b`, "gi"),
      (_m, h: string, u: string) => String(UNIT[h.toLowerCase()] * 100 + UNIT[u.toLowerCase()]),
    );
}

function wordsToDigits(raw: string) {
  const text = spokenPrices(raw);
  return text.replace(
    /\b((?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and)[\s-]+)*(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand))\b/gi,
    (m) => {
      const parts = m
        .toLowerCase()
        .split(/[\s-]+/)
        .filter((w) => w !== "and");
      if (
        parts.length === 1 &&
        !["hundred", "thousand"].includes(parts[0]) &&
        NUM_WORDS[parts[0]] < 20
      )
        return m;
      let total = 0;
      let cur = 0;
      for (const w of parts) {
        if (w === "hundred") cur = (cur || 1) * 100;
        else if (w === "thousand") {
          total += (cur || 1) * 1000;
          cur = 0;
        } else cur += NUM_WORDS[w] ?? 0;
      }
      return String(total + cur);
    },
  );
}

export function parseOffer(text: string, premium: number): number | undefined {
  const t = wordsToDigits(text).replace(/(\d),(\d{3})/g, "$1$2");
  const re = /(\$\s?)?(\d{1,5}(?:\.\d{1,2})?)\s*(%|percent|dollars|bucks)?([^.?!]{0,28})/gi;
  let found: number | undefined;
  for (const m of t.matchAll(re)) {
    const n = Number(m[2]);
    const unit = (m[3] ?? "").toLowerCase();
    const tail = (m[4] ?? "").toLowerCase();
    const before = t.slice(Math.max(0, (m.index ?? 0) - 24), m.index ?? 0).toLowerCase();
    if (
      !m[1] &&
      !unit &&
      !/month|mo\b|year|annual|off|discount/.test(tail) &&
      !/\$|price|rate|premium|offer|do|at|to|low as|go|is|be|pay|down|come|give|get/.test(before)
    )
      continue;
    let v: number;
    if (unit === "%" || unit === "percent") {
      if (!/off|discount|lower|reduc|less|save/.test(tail + before)) continue;
      v = premium * (1 - n / 100);
    } else if (
      /^\s*(off|discount|less)\b|\bdiscount\b/.test(tail) ||
      /(discount of|take off|knock off|reduce it by|lower it by|save you)\s*\$?\s*$/.test(before)
    ) {
      v = premium - n;
    } else if (/^\s*(a |per |\/ ?)?(year|yr|annual)|annually/.test(tail)) {
      v = n / 12;
    } else {
      v = n;
    }
    v = Math.round(v * 100) / 100;
    if (v >= premium * 0.4 && v <= premium * 1.3) found = v;
  }
  return found;
}

const ASSENT =
  /\b(yes|yeah|yep|sure|okay|ok|deal|agreed|we can do (that|it)|that works|i can (do|approve|offer) (that|it)|sounds good|you got it|done|approved|let'?s do it)\b/i;
const ASK_CUE =
  /\b(could you|can you|get (it )?to|bring it (down )?to|how about|would you|match|meet (us|her) at)\b/i;
const DENY = /\b(no|not|can'?t|cannot|unable|won'?t|isn'?t|don'?t)\b/i;

interface CallMemory {
  asks: number[];
  offers: number[];
  agreed?: number;
  confirmationSent?: boolean;
  closed?: boolean;
}
const memory = new Map<string, CallMemory>();

function rebuildMemory(transcript: Turn[], premium: number, call?: Call): CallMemory {
  const asks: number[] = [];
  const offers: number[] = [];
  for (const turn of transcript) {
    const v = parseOffer(turn.text, premium);
    if (v === undefined) continue;
    if (turn.speaker === "agent") {
      if (v < premium && ASK_CUE.test(turn.text)) asks.push(v);
    } else offers.push(v);
  }
  if (call?.ask !== undefined && asks[asks.length - 1] !== call.ask) asks.push(call.ask);
  return { asks, offers, agreed: call?.agreedMonthly };
}

export function plan(input: {
  role: Role;
  brief: Brief;
  insurer: string;
  theirOffer?: number;
  asks: number[];
  leverage?: Leverage;
  otherAgreed?: Leverage;
  selfAgreed?: number;
}): Plan {
  const { role, brief, theirOffer: O, asks, leverage: L } = input;
  const steps = ladder(brief, input.insurer);
  const lastAsk = asks[asks.length - 1];
  const nextLadder = steps[Math.min(asks.length, steps.length - 1)];
  const beat = (m: number) => Math.max(Math.round(m) - 5, Math.round(m * 0.95));

  if (input.selfAgreed !== undefined)
    return {
      action: "close",
      agreed: input.selfAgreed,
      endCall: true,
      reason: "agreed on this call",
    };
  if (input.otherAgreed)
    return {
      action: "wrap_up",
      leverage: input.otherAgreed,
      endCall: true,
      reason: `${input.otherAgreed.insurer} agreed`,
    };

  if (O === undefined) {
    if (role === "quote")
      return {
        action: "request_quote",
        leverage: L,
        endCall: false,
        reason: "need their best number",
      };
    const ask = L ? Math.min(nextLadder, beat(L.monthly)) : nextLadder;
    return {
      action: asks.length ? "counter" : "open",
      ask,
      leverage: L,
      endCall: false,
      reason: L ? "ask retention to beat competitor" : "open with evidence",
    };
  }

  const better = L && L.monthly < O - 0.5 ? L : undefined;
  const metAsk = lastAsk !== undefined && O <= lastAsk + 0.5;
  if ((O <= brief.fair || metAsk) && (!better || asks.length >= 3))
    return { action: "accept", agreed: O, endCall: false, reason: "at or below target" };
  if (O <= brief.walkAway && !better && asks.length >= 2)
    return {
      action: "accept",
      agreed: O,
      endCall: false,
      reason: "inside walk-away after two counters",
    };
  if (asks.length >= 4) {
    if (O <= brief.walkAway && !better)
      return {
        action: "accept",
        agreed: O,
        endCall: false,
        reason: "final round inside walk-away",
      };
    return {
      action: "walk",
      leverage: better,
      endCall: true,
      reason: better ? "better offer elsewhere" : "above walk-away after four counters",
    };
  }
  let ask = nextLadder;
  if (better) ask = Math.min(ask, beat(better.monthly));
  else if (L && role === "retention") ask = Math.min(ask, beat(L.monthly));
  ask = Math.min(ask, Math.round(O) - 1);
  if (lastAsk !== undefined && ask < lastAsk) ask = Math.min(lastAsk, Math.round(O) - 1);
  return {
    action: "counter",
    ask,
    leverage: better ?? (role === "retention" ? L : undefined),
    endCall: false,
    reason: better ? "use better live offer" : "next ladder step",
  };
}

export function evidenceFor(brief: Brief, insurer?: string): Evidence[] {
  if (!insurer || insurer === brief.policy.insurer) return brief.evidence;
  const rest = brief.evidence.filter((e) => e.kind !== "network");
  const peer = brief.net?.market.insurers.find((i) => i.insurer === insurer);
  if (!peer) return rest;
  const who = brief.policy.kind === "auto" ? "drivers" : "members";
  return [
    {
      kind: "network",
      label: `${peer.count} ${who} like ${brief.person.firstName} at ${insurer.split(" ")[0]} · Service Haggle network`,
      say: `${peer.count} people with ${brief.person.firstName}'s profile pay ${usd(peer.min)} to ${usd(peer.max)} a month at ${insurer}`,
    },
    ...rest,
  ];
}

function pickEvidence(brief: Brief, n = 2, insurer?: string) {
  const order: Evidence["kind"][] = ["network", "bank", "exa", "reference"];
  return [...evidenceFor(brief, insurer)]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, n);
}

function leverageLabel(l: Leverage) {
  return `${l.insurer} offer ${usd(l.monthly)} · ${l.agreed ? "agreed" : l.live ? "live call" : "quote"}`;
}

function template(
  p: Plan,
  brief: Brief,
  role: Role,
  theirOffer: number | undefined,
  ev: Evidence[],
): string {
  const name = brief.person.firstName;
  const kind = String(brief.policy.kind);
  const cite = ev.map((e) => e.say).join(", and ");
  const lev = p.leverage;
  switch (p.action) {
    case "open":
      return lev
        ? `${lev.insurer} has offered ${usd(lev.monthly)} a month for the same cover. Can you beat that and keep ${name} at ${usd(p.ask!)}?`
        : `${name} is renewing at ${usd(brief.premium)} a month. ${cite ? `${cite[0].toUpperCase()}${cite.slice(1)}. ` : ""}Could you bring it to ${usd(p.ask!)}?`;
    case "request_quote":
      return `${name} wants the same ${kind} cover she has now: ${brief.policy.product}. What's the best monthly price you can do${lev ? `? For reference, she has ${usd(lev.monthly)} a month from another provider` : ""}?`;
    case "counter":
      return lev
        ? `Thanks. ${name} has ${usd(lev.monthly)} a month from ${lev.insurer} for the same cover. Can you get to ${usd(p.ask!)}?`
        : `I appreciate that${theirOffer ? ` at ${usd(theirOffer)}` : ""}. ${cite ? `${cite[0].toUpperCase()}${cite.slice(1)}. ` : ""}Could you get to ${usd(p.ask!)} a month?`;
    case "accept":
      return `That works. Let's lock in ${usd(p.agreed!)} a month${role === "retention" ? ` from the ${shortDate(brief.policy.renewsOn)} renewal` : ""}, same coverage. I'll email a confirmation right now. Could you reply to it to confirm in writing?`;
    case "close":
      return `Thank you so much for your help today. Have a great day!`;
    case "wrap_up":
      return role === "quote"
        ? `Thanks so much for the quote. ${name} has gone with another offer for now, so we'll leave it there. Have a great day!`
        : `Thanks for your time today. ${name} has accepted another offer, so she'll be in touch about the renewal. Have a good one!`;
    case "walk":
      return `Thanks for checking. That's still above what ${name} is seeing elsewhere, so we'll pass for now. She'll be in touch if anything changes.`;
  }
}

const LEAK =
  /walk.?away|bottom line|lowest (she|we)|maximum|minimum|budget|salary|income|raise|paycheck|\b118\b|date of birth|licen[cs]e number/i;

function leakFree(say: string, allowed: number[], brief: Brief) {
  if (LEAK.test(say)) return false;
  const nums = [...say.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\$\s?(\d+(?:\.\d+)?)/g)].map(
    (m) => Number(m[1]),
  );
  const ok = new Set(allowed.map((n) => Math.round(n)));
  if (nums.some((n) => !ok.has(Math.round(n)))) return false;
  if (
    !ok.has(Math.round(brief.walkAway)) &&
    new RegExp(`\\b${Math.round(brief.walkAway)}\\b`).test(say)
  )
    return false;
  return true;
}

async function phrase(
  p: Plan,
  brief: Brief,
  role: Role,
  insurer: string,
  req: DelegationRequest,
  theirOffer: number | undefined,
  ev: Evidence[],
): Promise<string> {
  const fallback = template(p, brief, role, theirOffer, ev);
  if (!hasModel() || process.env.STRATEGIST_TEMPLATES === "1") return fallback;
  const allowed = [
    brief.premium,
    p.ask,
    p.agreed,
    theirOffer,
    p.leverage?.monthly,
    brief.net?.min,
    brief.net?.max,
    p.agreed !== undefined ? brief.premium - p.agreed : undefined,
    ...ev.flatMap((e) =>
      [...e.say.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\$(\d+(?:\.\d+)?)/g)].map((m) =>
        Number(m[1]),
      ),
    ),
  ].filter((n): n is number => typeof n === "number");
  try {
    const say = await generateLine({
      tier: "fast",
      timeoutMs: Number(process.env.STRATEGIST_TIMEOUT_MS ?? 1800),
      system: `You are the negotiation strategist behind Service Haggle's voice agent. The agent is on a live phone call with a representative at ${insurer} (${role === "retention" ? `${brief.person.firstName}'s current insurer` : "a competitor giving a quote"}) on behalf of ${brief.person.name}. The decision below is final; write the exact next line the agent should say.
Rules: 1-2 short spoken sentences, warm and confident, no lists, no markdown. Use only the dollar amounts in DECISION and EVIDENCE, exactly. Refer to the customer as ${brief.person.firstName} or "she". Never mention any walk-away, limit, budget, minimum, salary, income or anything not in SHAREABLE FACTS or EVIDENCE. If the representative asked something in REQUEST, answer briefly from SHAREABLE FACTS (or say she can follow up by email) before the decision. Output only the line.`,
      prompt: JSON.stringify({
        DECISION: {
          action: p.action,
          ask: p.ask,
          theirOffer,
          agreed: p.agreed,
          leverage: p.leverage
            ? {
                insurer: p.leverage.insurer,
                monthly: p.leverage.monthly,
                status: p.leverage.agreed ? "agreed" : "live offer",
              }
            : undefined,
          endCall: p.endCall,
          example: fallback,
        },
        EVIDENCE: ev.map((e) => e.say),
        SHAREABLE_FACTS: brief.shareable,
        REQUEST: req.request,
        RECENT: req.transcript
          .slice(-6)
          .map((t) => `${t.speaker === "agent" ? "Agent" : "Rep"}: ${t.text}`),
      }),
    });
    const clean = say.replace(/^["'\s]+|["'\s]+$/g, "");
    if (!clean || clean.length > 400 || !leakFree(clean, allowed, brief)) return fallback;
    return clean;
  } catch (e) {
    console.error("[strategist] phrase fallback:", e instanceof Error ? e.message : e);
    return fallback;
  }
}

async function onAgreement(
  callId: string,
  brief: Brief,
  insurer: string,
  agreed: number,
  call?: Call,
) {
  const m = memory.get(callId);
  if (m?.confirmationSent) return;
  if (m) m.confirmationSent = true;
  const signalId = `sig-call-agreed-${callId}`;
  const existing = (await store.signals(brief.policy.id)).find((s) => s.id === signalId);
  if (existing) return;
  await store.addSignal({
    id: signalId,
    personId: brief.policy.personId,
    policyId: brief.policy.id,
    at: new Date().toISOString().slice(0, 10),
    source: "call",
    title: `${insurer} agreed to ${usd(agreed)}/mo on the phone (was ${usd(brief.premium)}). Confirming by email.`,
    impactMonthly: Math.round(agreed - brief.premium),
  });
  await store.putStance({
    ...(brief.stance ?? {
      policyId: brief.policy.id,
      fairMonthly: brief.fair,
      walkAwayMonthly: brief.walkAway,
    }),
    policyId: brief.policy.id,
    verdict: "negotiating",
    fairMonthly: brief.fair,
    walkAwayMonthly: brief.walkAway,
    headline: `${insurer.split(" ")[0]} agreed to ${usd(agreed)}. Confirming by email.`,
    detail: `That saves ${usd(brief.premium - agreed)} a month once they confirm in writing. You sign, not me.`,
    activity: "waiting for written confirmation",
    updatedAt: new Date().toISOString(),
  });
  invalidateBrief(brief.policy.id);
  const target: Call =
    call ??
    ({
      id: callId,
      policyId: brief.policy.id,
      status: "live",
      channel: "phone",
      insurer,
      role: insurer === brief.policy.insurer ? "retention" : "quote",
      counterpart: insurer,
      startedAt: new Date().toISOString(),
      citing: [],
      transcript: [],
    } as Call);
  if (brokerEmailFor(insurer)) {
    sendConfirmation({ ...target, agreedMonthly: agreed }).catch((e) =>
      console.error("[strategist] confirmation email failed:", e),
    );
    return;
  }
  await startDealFor(callId, brief.policy.id, insurer, agreed);
}

// Close the agreed price over email via the app (the voice worker may exit when the call ends).
async function startDealFor(callId: string, policyId: string, insurer: string, monthly: number) {
  const base =
    process.env.PUBLIC_BASE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://service-haggle.vercel.app");
  try {
    const res = await fetch(`${base}/api/deals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callId, policyId, monthly, insurer }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  } catch (e) {
    console.error("[strategist] couldn't start the deal over email:", e);
  }
}

// After a call ends: if the agent clearly accepted a price ("we'll take 178") but no agreement
// was recorded, record it and start closing it.
export async function reconcileAgreement(callId: string) {
  const call = await store.call(callId);
  if (!call || call.agreedMonthly !== undefined || call.channel === "email") return;
  const brief = await getBrief(call.policyId);
  const accept =
    /\b(we'?ll take|we accept|we'?ll accept|let'?s (do|lock in|go with)|lock (it )?in|agreed? (on|to|at)|deal at)\b/i;
  for (const t of [...call.transcript].reverse()) {
    if (t.speaker !== "agent" || !accept.test(t.text)) continue;
    const amount = parseOffer(
      t.text.replace(accept, (m) => `${m} at`),
      brief.premium,
    );
    if (amount === undefined || amount > brief.walkAway) return;
    await persistCall(callId, { agreedMonthly: amount });
    await onAgreement(callId, brief, call.insurer, amount, { ...call, agreedMonthly: amount });
    return;
  }
}

async function persistCall(
  callId: string,
  patch: Partial<Pick<Call, "theirOffer" | "ask" | "agreedMonthly" | "citing">>,
) {
  const fresh = await store.call(callId);
  if (!fresh) return;
  const next = { ...fresh };
  if (patch.theirOffer !== undefined) next.theirOffer = patch.theirOffer;
  if (patch.ask !== undefined) next.ask = patch.ask;
  if (patch.agreedMonthly !== undefined) next.agreedMonthly = patch.agreedMonthly;
  if (patch.citing?.length) next.citing = [...new Set([...(fresh.citing ?? []), ...patch.citing])];
  await store.putCall(next);
}

export async function handleDelegation(req: DelegationRequest): Promise<DelegationResult> {
  const [call, offers] = await Promise.all([
    store.call(req.callId).catch(() => undefined),
    competingOffers(req.callId).catch(() => [] as Leverage[]),
  ]);
  const policyId = call?.policyId ?? req.policyId;
  let brief: Brief;
  try {
    brief = await getBrief(policyId);
  } catch (e) {
    console.error("[strategist] brief failed:", e);
    return { say: "Let me check on that and get right back to you.", citing: [] };
  }
  const insurer = call?.insurer ?? brief.policy.insurer;
  const role: Role = call?.role ?? (insurer === brief.policy.insurer ? "retention" : "quote");

  let mem = memory.get(req.callId);
  if (!mem) {
    mem = rebuildMemory(req.transcript, brief.premium, call);
    memory.set(req.callId, mem);
  }
  if (call?.agreedMonthly !== undefined) mem.agreed = call.agreedMonthly;

  const lastAsk = mem.asks[mem.asks.length - 1];
  // Everything they've said since our last ask: "Okay." followed by "Hello?" is still a yes.
  const askIdx = req.transcript.findLastIndex(
    (t) =>
      t.speaker === "agent" &&
      lastAsk !== undefined &&
      parseOffer(t.text, brief.premium) === lastAsk,
  );
  const since = req.transcript.slice(askIdx + 1).filter((t) => t.speaker === "counterpart");
  const lastRep =
    since.at(-1) ?? [...req.transcript].reverse().find((t) => t.speaker === "counterpart");
  const repText = lastRep?.text ?? "";
  const sinceText = since.map((t) => t.text).join(" ");
  let theirOffer =
    parseOffer(repText, brief.premium) ??
    parseOffer(sinceText, brief.premium) ??
    parseOffer(req.request, brief.premium);
  if (
    theirOffer === undefined &&
    lastAsk !== undefined &&
    ASSENT.test(sinceText) &&
    !DENY.test(sinceText)
  )
    theirOffer = lastAsk;
  if (theirOffer === undefined) theirOffer = mem.offers[mem.offers.length - 1] ?? call?.theirOffer;
  if (theirOffer !== undefined && mem.offers[mem.offers.length - 1] !== theirOffer)
    mem.offers.push(theirOffer);

  const real = offers.filter((o) => o.monthly > 0);
  const otherAgreed = real.find((o) => o.agreed);
  const leverage =
    real.filter((o) => !o.agreed).sort((a, b) => a.monthly - b.monthly)[0] ?? otherAgreed;

  const p = plan({
    role,
    brief,
    insurer,
    theirOffer,
    asks: mem.asks,
    leverage,
    otherAgreed: mem.agreed === undefined ? otherAgreed : undefined,
    selfAgreed: mem.agreed,
  });

  const ev =
    p.action === "open" || p.action === "counter"
      ? pickEvidence(brief, p.leverage ? 1 : 2, insurer)
      : [];
  const citing = [...(p.leverage ? [leverageLabel(p.leverage)] : []), ...ev.map((e) => e.label)];
  const say = await phrase(p, brief, role, insurer, req, theirOffer, ev);

  if (p.ask !== undefined && mem.asks[mem.asks.length - 1] !== p.ask) mem.asks.push(p.ask);
  if (p.action === "accept" && p.agreed !== undefined) {
    mem.agreed = p.agreed;
    onAgreement(req.callId, brief, insurer, p.agreed, call).catch((e) =>
      console.error("[strategist] agreement bookkeeping failed:", e),
    );
  }
  if (p.endCall) mem.closed = true;

  const result: DelegationResult = {
    say,
    ...(theirOffer !== undefined ? { theirOffer } : {}),
    ...(p.ask !== undefined ? { ask: p.ask } : {}),
    ...(p.action === "accept" || p.action === "close"
      ? { agreedMonthly: p.agreed ?? mem.agreed }
      : {}),
    citing,
    endCall: p.endCall,
  };
  await persistCall(req.callId, {
    theirOffer,
    ask: p.ask,
    agreedMonthly: result.agreedMonthly,
    citing,
  }).catch((e) => console.error("[strategist] call update failed:", e));
  return result;
}

export interface DecideState {
  policy: Partial<Policy> & {
    id?: string;
    insurer?: string;
    line?: string;
    premium_monthly?: number;
  };
  quotes: {
    id?: string;
    insurer: string;
    premium_monthly?: number;
    monthly?: number;
    status?: string;
  }[];
  thread: {
    from?: string;
    role?: string;
    speaker?: string;
    text?: string;
    body?: string;
    at?: string;
  }[];
}

export interface Decision {
  action: "request_quote" | "counter" | "accept" | "walk" | "ask_human";
  message_brief: string;
  talking_points: string[];
}

const OURS = /^(agent|us|me|lowball|assistant|user|maya|customer|self)$/i;

async function resolvePolicyId(p: DecideState["policy"]) {
  if (p.id && (await store.policy(p.id))) return p.id;
  const all = await store.policies();
  const kind = p.kind ?? p.line;
  return (
    all.find((x) => p.insurer && x.insurer === p.insurer && (!kind || x.kind === kind))?.id ??
    all.find((x) => kind && x.kind === kind)?.id ??
    all.find((x) => p.insurer && x.insurer === p.insurer)?.id
  );
}

export async function decide(state: DecideState): Promise<Decision> {
  const policyId = await resolvePolicyId(state.policy);
  if (!policyId) {
    return {
      action: "ask_human",
      message_brief:
        "I don't recognise this policy yet. Please forward the declarations page so I can take a position.",
      talking_points: [],
    };
  }
  const brief = await getBrief(policyId);
  const insurer = state.policy.insurer ?? brief.policy.insurer;
  const role: Role = insurer === brief.policy.insurer ? "retention" : "quote";
  const text = (m: DecideState["thread"][number]) => m.text ?? m.body ?? "";
  const ours = (m: DecideState["thread"][number]) =>
    OURS.test(m.role ?? m.speaker ?? "") || (!!m.from && /lowball|agentmail/i.test(m.from));
  const asks = state.thread
    .filter(ours)
    .map((m) => parseOffer(text(m), brief.premium))
    .filter((n): n is number => n !== undefined);
  const theirs = state.thread.filter((m) => !ours(m));
  const lastTheirs = theirs[theirs.length - 1];
  let theirOffer = lastTheirs ? parseOffer(text(lastTheirs), brief.premium) : undefined;
  if (
    theirOffer === undefined &&
    lastTheirs &&
    asks.length &&
    ASSENT.test(text(lastTheirs)) &&
    !DENY.test(text(lastTheirs))
  )
    theirOffer = asks[asks.length - 1];
  const quotes = state.quotes
    .map((q) => ({
      insurer: q.insurer,
      monthly: q.monthly ?? q.premium_monthly ?? NaN,
      status: q.status,
    }))
    .filter((q) => Number.isFinite(q.monthly) && q.insurer !== insurer);
  const best = quotes.sort((a, b) => a.monthly - b.monthly)[0];
  const leverage: Leverage | undefined = best
    ? {
        insurer: best.insurer,
        monthly: best.monthly,
        live: true,
        agreed: /accept|agreed|bound/i.test(best.status ?? ""),
      }
    : undefined;

  if (!state.thread.length && !quotes.length) {
    const ev = pickEvidence(brief, 2, insurer);
    return {
      action: "request_quote",
      message_brief: `Ask ${insurer} for its best monthly price for identical cover (${brief.policy.product}).`,
      talking_points: [...brief.shareable.slice(0, 4), ...ev.map((e) => e.say)],
    };
  }

  const p = plan({
    role,
    brief,
    insurer,
    theirOffer,
    asks,
    leverage,
    otherAgreed: leverage?.agreed ? leverage : undefined,
  });
  const ev = pickEvidence(brief, 2, insurer);
  const points = [
    ...(p.leverage
      ? [`${p.leverage.insurer} has offered ${usd(p.leverage.monthly)} a month for the same cover.`]
      : []),
    ...ev.map((e) => e.say),
  ];
  switch (p.action) {
    case "request_quote":
      return {
        action: "request_quote",
        message_brief: `Ask ${insurer} for its best monthly price for identical cover.`,
        talking_points: points,
      };
    case "open":
    case "counter":
      return {
        action: "counter",
        message_brief: `${theirOffer !== undefined ? `Thank them for ${usd(theirOffer)} a month and a` : "A"}sk for ${usd(p.ask!)} a month for the same cover.`,
        talking_points: points,
      };
    case "accept":
      return {
        action: "accept",
        message_brief: `Accept ${usd(p.agreed!)} a month for identical cover and ask ${insurer} to send written confirmation and e-sign documents to ${brief.person.firstName}. Do not sign or pay anything.`,
        talking_points: [
          `Agreed price: ${usd(p.agreed!)} a month`,
          "Same coverage as today",
          `${brief.person.firstName} signs; Service Haggle never signs or pays`,
        ],
      };
    case "walk":
    case "wrap_up":
      return {
        action: "walk",
        message_brief: p.leverage?.agreed
          ? `Thank ${insurer} and say ${brief.person.firstName} has gone with another offer.`
          : `Thank ${insurer} for the quote and decline politely for now.`,
        talking_points: points,
      };
    case "close":
      return {
        action: "ask_human",
        message_brief: `${brief.person.firstName} needs to review and e-sign the confirmed offer.`,
        talking_points: [],
      };
  }
}
