import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { detectLifeEvents, networkStats } from "@/lib/monitor";
import { store } from "@/lib/store";
import { exaExtractPrice, exaSearch, hasExa, hasKernel, kernelRead } from "../research";

export const exaResearch = createTool({
  id: "exa-research",
  description:
    "Search the web with Exa for real insurance market facts (rate filings, price changes, discount programs, competitor pricing). Returns titles, URLs, publish dates and highlights. Only cite what these results say.",
  inputSchema: z.object({
    query: z.string().describe("Natural-language search, e.g. 'California auto insurance rate increase approved 2026'"),
    startPublishedDate: z.string().optional().describe("ISO date; only when a bounded window is required"),
    endPublishedDate: z.string().optional().describe("ISO date; only when a bounded window is required"),
  }),
  execute: async ({ query, startPublishedDate, endPublishedDate }) => {
    if (!hasExa()) return { error: "EXA_API_KEY is not set, so I can't research the web right now." };
    const results = await exaSearch(query, { start: startPublishedDate, end: endPublishedDate });
    return { results: results.map((r) => ({ ...r, highlight: r.highlight.slice(0, 1200) })) };
  },
});

export const exaPrices = createTool({
  id: "exa-prices",
  description: "Extract explicitly stated monthly premiums from web pages via Exa structured output (e.g. average full-coverage price in San Francisco). Every price comes with a quote and URL.",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    if (!hasExa()) return { error: "EXA_API_KEY is not set." };
    return exaExtractPrice(query);
  },
});

export const kernelPage = createTool({
  id: "kernel-read-page",
  description: "Open a JavaScript-heavy page (insurer quote or rate page) in a Kernel cloud browser and return its visible text.",
  inputSchema: z.object({ url: z.string().url(), waitMs: z.number().int().min(0).max(15000).optional() }),
  execute: async ({ url, waitMs }) => {
    if (!hasKernel()) return { error: "KERNEL_API_KEY is not set, so I can't open browser pages right now." };
    const page = await kernelRead(url, waitMs);
    return { ...page, text: page.text.slice(0, 6000) };
  },
});

export const networkRates = createTool({
  id: "network-rates",
  description: "Pooled monthly rates Lowball members with the same profile pay at this insurer and its competitors (demo data).",
  inputSchema: z.object({ policyId: z.string() }),
  execute: async ({ policyId }) => {
    const policy = await store.policy(policyId);
    if (!policy) return { error: `Unknown policy ${policyId}` };
    return { network: await networkStats(policy), note: "Seeded demo data from the Lowball member network." };
  },
});

export const lifeEvents = createTool({
  id: "life-events",
  description: "Life changes detected from the person's bank transactions (e.g. a raise, driving less). Disclosure says whether each may ever be mentioned to an insurer.",
  inputSchema: z.object({ asOf: z.string().optional() }),
  execute: async ({ asOf }) => ({ events: detectLifeEvents(await store.transactions(), asOf), note: "Transactions are seeded demo data." }),
});
