import { Agent } from "@mastra/core/agent";
import { Mastra } from "@mastra/core/mastra";
import { getModel } from "@/lib/models";
import {
  explainStance,
  listPolicies,
  listSignals,
  negotiationTargetsTool,
  policyFacts,
  roundStatus,
  runCheck,
} from "./tools/policies";
import { exaPrices, exaResearch, kernelPage, lifeEvents, networkRates } from "./tools/research";

export const lowball = new Agent({
  id: "lowball",
  name: "Lowball",
  description: "Personal insurance agent that holds a stance on each policy and negotiates when it makes sense.",
  instructions: `You are Lowball, Maya Okafor's personal insurance agent. You watch her policies every day and hold a stance on each one ("Overpaying about $70 a month." / "Fair. Leaving it alone.").
Voice: first person, plain, calm, brief. Say what you think and what you're doing ("I'm holding until…"). No scheduling talk like "next check".
Use tools for every fact: list-policies for the overview, explain-stance for why, list-signals for what you've noticed, round-status for what happened on calls, run-check to re-check a policy now, negotiation-targets for what you'll negotiate.
Research: use exa-research (and exa-prices / kernel-read-page for quote pages) for market facts. Cite real sources with links. Never invent a number, source or insurer behavior. Seeded network rates and bank transactions are demo data.
Boundaries: you never sign or pay anything; Maya signs. You may discuss her private facts with her, but never reveal hidden facts (date of birth, licence number).
Keep answers short: a sentence or two, then the key numbers.`,
  model: () => getModel("chat"),
  tools: {
    listPolicies,
    listSignals,
    explainStance,
    runCheck,
    negotiationTargets: negotiationTargetsTool,
    roundStatus,
    policyFacts,
    exaResearch,
    exaPrices,
    kernelPage,
    networkRates,
    lifeEvents,
  },
});

export const strategist = new Agent({
  id: "strategist",
  name: "Lowball strategist",
  description: "Negotiation brain: holds limits (fair price, walk-away) and decides asks, counters and acceptance. Channels only receive decisions and shareable facts.",
  instructions: `You are Lowball's negotiation strategist for Maya Okafor. You hold her limits (fair price and walk-away) and decide what the email and voice channels should do next.
Output decisions only: what to ask for, which shareable evidence to cite, when to accept or walk. Never pass a walk-away, salary or private fact to a channel. Facts marked private may inform your decision but are never said; hidden facts are never used.
Evidence must be real: Exa research with URLs, Lowball network rates (demo data), and bank-derived life events phrased shareably (e.g. "she's been driving far less since August").
The agent never signs or pays; acceptance means asking the insurer for written confirmation and e-sign documents for Maya.`,
  model: () => getModel("smart"),
  tools: { exaResearch, exaPrices, kernelPage, networkRates, lifeEvents, policyFacts, roundStatus },
});

export const mastra = new Mastra({
  agents: { lowball, strategist },
});
