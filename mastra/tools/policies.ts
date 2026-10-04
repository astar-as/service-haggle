import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { checkPolicy, computeAnchors, detectLifeEvents, negotiationTargets, networkStats } from "@/lib/monitor";
import { getBrief } from "@/lib/strategist";
import { store } from "@/lib/store";
import type { Fact } from "@/lib/types";

export const listPolicies = createTool({
  id: "list-policies",
  description: "List the user's insurance policies with Service Haggle's current stance on each (verdict, fair price, headline, what it's doing).",
  inputSchema: z.object({}),
  execute: async () => {
    const [policies, stances, calls] = await Promise.all([store.policies(), store.stances(), store.calls()]);
    return {
      policies: policies.map((p) => {
        const s = stances.find((x) => x.policyId === p.id);
        const live = calls.filter((c) => c.policyId === p.id && c.status !== "ended");
        return {
          id: p.id,
          kind: p.kind,
          insurer: p.insurer,
          product: p.product,
          monthlyPremium: p.monthlyPremium,
          renewsOn: p.renewsOn,
          verdict: s?.verdict,
          fairMonthly: s?.fairMonthly,
          headline: s?.headline,
          detail: s?.detail,
          activity: s?.activity,
          liveCalls: live.map((c) => ({ id: c.id, insurer: c.insurer, role: c.role, status: c.status })),
        };
      }),
    };
  },
});

export const listSignals = createTool({
  id: "list-signals",
  description: "List what Service Haggle has noticed (signals) for one policy or all policies, newest first, with sources and links.",
  inputSchema: z.object({ policyId: z.string().optional(), limit: z.number().int().min(1).max(50).optional() }),
  execute: async ({ policyId, limit }) => {
    const signals = await store.signals(policyId);
    return { signals: signals.slice(0, limit ?? 15) };
  },
});

export const explainStance = createTool({
  id: "explain-stance",
  description: "Explain why Service Haggle holds its stance on a policy: the numbers, network rates, bank-derived life events, research signals with URLs, and the negotiation limits.",
  inputSchema: z.object({ policyId: z.string() }),
  execute: async ({ policyId }) => {
    const policy = await store.policy(policyId);
    if (!policy) return { error: `Unknown policy ${policyId}` };
    const [stance, signals, transactions] = await Promise.all([store.stance(policyId), store.signals(policyId), store.transactions()]);
    const net = await networkStats(policy);
    const brief = await getBrief(policyId);
    return {
      policy: { id: policy.id, insurer: policy.insurer, kind: policy.kind, product: policy.product, monthlyPremium: policy.monthlyPremium, renewsOn: policy.renewsOn },
      stance,
      anchors: computeAnchors(policy, net, stance),
      network: net,
      lifeEvents: detectLifeEvents(transactions).filter((e) => e.kinds.includes(String(policy.kind))),
      evidenceUsedOnCalls: brief.evidence,
      signals: signals.slice(0, 10),
    };
  },
});

export const runCheck = createTool({
  id: "run-check",
  description: "Re-check one policy now: gather fresh research (Exa), network rates and bank signals, then update Service Haggle's stance.",
  inputSchema: z.object({ policyId: z.string() }),
  execute: async ({ policyId }) => {
    const res = await checkPolicy(policyId);
    return { stance: res.stance, newSignals: res.signals, researchCount: res.findings.length, usedModel: res.usedModel };
  },
});

export const negotiationTargetsTool = createTool({
  id: "negotiation-targets",
  description: "List the policies Service Haggle has flagged for negotiation, with the gap to a fair price and the channel it will use.",
  inputSchema: z.object({}),
  execute: async () => ({ targets: await negotiationTargets() }),
});

const visible = (facts: Fact[], audience: "user" | "channel") =>
  facts.filter((f) => f.disclosure !== "hidden" && (audience === "user" || f.disclosure === "shareable"));

export const policyFacts = createTool({
  id: "policy-facts",
  description:
    "Facts about the person and a policy, filtered by disclosure. audience 'channel' returns only shareable facts (what may be said to an insurer); 'user' adds private facts for talking with the person. Hidden facts are never returned.",
  inputSchema: z.object({ policyId: z.string(), audience: z.enum(["user", "channel"]).default("channel") }),
  execute: async ({ policyId, audience }) => {
    const [person, policy] = await Promise.all([store.person(), store.policy(policyId)]);
    if (!policy) return { error: `Unknown policy ${policyId}` };
    return {
      person: { name: person.name, city: person.city, state: person.state, facts: visible(person.facts, audience) },
      policy: { insurer: policy.insurer, product: policy.product, monthlyPremium: policy.monthlyPremium, renewsOn: policy.renewsOn, memberSince: policy.memberSince, facts: visible(policy.facts, audience) },
    };
  },
});

export const roundStatus = createTool({
  id: "round-status",
  description: "What happened on negotiation calls: each round of parallel calls for a policy, with each insurer's role, offers, asks, agreement and the last few lines of transcript.",
  inputSchema: z.object({ policyId: z.string().optional() }),
  execute: async ({ policyId }) => {
    const calls = (await store.calls()).filter((c) => !policyId || c.policyId === policyId);
    const rounds = new Map<string, typeof calls>();
    for (const c of calls) rounds.set(c.roundId ?? c.id, [...(rounds.get(c.roundId ?? c.id) ?? []), c]);
    return {
      rounds: [...rounds.entries()].map(([roundId, cs]) => ({
        roundId,
        policyId: cs[0].policyId,
        calls: cs.map((c) => ({
          id: c.id,
          insurer: c.insurer,
          role: c.role,
          status: c.status,
          theirOffer: c.theirOffer,
          ask: c.ask,
          agreedMonthly: c.agreedMonthly,
          citing: c.citing,
          lastLines: c.transcript.slice(-4).map((t) => `${t.speaker}: ${t.text}`),
        })),
      })),
    };
  },
});
