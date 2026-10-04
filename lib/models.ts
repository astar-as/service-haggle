import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import { generateText } from "ai";
import type { z } from "zod";

export type ModelTier = "smart" | "fast" | "chat";

export class ModelUnavailableError extends Error {
  constructor() {
    super(
      "No model configured. Set NEON_AI_GATEWAY_URL + NEON_AI_GATEWAY_KEY (Neon AI Gateway) or OPENAI_API_KEY.",
    );
    this.name = "ModelUnavailableError";
  }
}

function neonConfig() {
  const url = process.env.NEON_AI_GATEWAY_URL ?? process.env.NEON_AI_GATEWAY_BASE_URL;
  const key = process.env.NEON_AI_GATEWAY_KEY ?? process.env.NEON_AI_GATEWAY_TOKEN;
  if (!url || !key) return null;
  const base = url.replace(/\/+$/, "");
  return { baseURL: base.endsWith("/v1") ? base : `${base}/v1`, apiKey: key };
}

export function modelProvider(): "neon" | "openai" | null {
  if (neonConfig()) return "neon";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export const hasModel = () => modelProvider() !== null;

function modelId(tier: ModelTier, provider: "neon" | "openai") {
  if (provider === "neon") {
    const smart = process.env.STRATEGIST_MODEL ?? "gpt-5-4-mini";
    if (tier === "fast") return process.env.FAST_MODEL ?? "claude-haiku-4-5";
    if (tier === "chat") return process.env.CHAT_MODEL ?? smart;
    return smart;
  }
  const smart = process.env.OPENAI_MODEL ?? "gpt-5-mini";
  if (tier === "fast") return process.env.OPENAI_FAST_MODEL ?? smart;
  if (tier === "chat") return process.env.OPENAI_CHAT_MODEL ?? smart;
  return smart;
}

const cache = new Map<string, LanguageModelV4>();

export function getModel(tier: ModelTier = "smart"): LanguageModelV4 {
  const provider = modelProvider();
  if (!provider) throw new ModelUnavailableError();
  const id = modelId(tier, provider);
  const key = `${provider}:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let model: LanguageModelV4;
  if (provider === "neon") {
    const neon = createOpenAICompatible({ name: "neon", ...neonConfig()! });
    model = neon.chatModel(id);
  } else {
    model = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id);
  }
  cache.set(key, model);
  return model;
}

export function describeModels() {
  const provider = modelProvider();
  if (!provider) return { provider: null };
  return { provider, smart: modelId("smart", provider), fast: modelId("fast", provider), chat: modelId("chat", provider) };
}

function providerOptions(tier: ModelTier) {
  if (modelProvider() !== "openai" || tier !== "fast") return undefined;
  const effort = process.env.OPENAI_FAST_REASONING ?? "minimal";
  return { openai: { reasoningEffort: effort } };
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1));
}

export async function generateJson<T>(
  schema: z.ZodType<T>,
  opts: { system: string; prompt: string; tier?: ModelTier; timeoutMs?: number },
): Promise<T> {
  const tier = opts.tier ?? "smart";
  const { text } = await generateText({
    model: getModel(tier),
    system: `${opts.system}\n\nRespond with a single JSON object only. No prose, no code fences.`,
    prompt: opts.prompt,
    timeout: opts.timeoutMs,
    maxRetries: tier === "fast" ? 0 : 1,
    providerOptions: providerOptions(tier),
  });
  const parsed = schema.safeParse(extractJson(text));
  if (!parsed.success) throw new Error(`Model JSON did not match schema: ${parsed.error.message}`);
  return parsed.data;
}

export async function generateLine(opts: { system: string; prompt: string; tier?: ModelTier; timeoutMs?: number }) {
  const tier = opts.tier ?? "fast";
  const { text } = await generateText({
    model: getModel(tier),
    system: opts.system,
    prompt: opts.prompt,
    timeout: opts.timeoutMs,
    maxRetries: 0,
    providerOptions: providerOptions(tier),
  });
  return text.trim();
}
