import Exa from "exa-js";
import Kernel from "@onkernel/sdk";

export interface Finding {
  title: string;
  url: string;
  publishedDate?: string;
  highlight: string;
  query: string;
}

export const hasExa = () => !!process.env.EXA_API_KEY;
export const hasKernel = () => !!process.env.KERNEL_API_KEY;

let exaClient: Exa | null = null;
function exa() {
  if (!process.env.EXA_API_KEY) throw new Error("EXA_API_KEY is not set");
  exaClient ??= new Exa(process.env.EXA_API_KEY);
  return exaClient;
}

export async function exaSearch(query: string, window?: { start?: string; end?: string }): Promise<Finding[]> {
  const res = await exa().search(query, {
    type: "auto",
    contents: { highlights: true },
    ...(window?.start ? { startPublishedDate: window.start } : {}),
    ...(window?.end ? { endPublishedDate: window.end } : {}),
  });
  return res.results.map((r) => ({
    title: (r.title ?? "").trim() || hostOf(r.url),
    url: r.url,
    publishedDate: r.publishedDate,
    highlight: (r.highlights ?? []).join(" … ").replace(/\s+/g, " ").trim(),
    query,
  }));
}

export interface ExtractedPrice {
  monthly: number | null;
  insurer: string | null;
  quote: string;
  url: string;
}

export async function exaExtractPrice(query: string): Promise<{ prices: ExtractedPrice[]; citations: { url: string; title: string }[] }> {
  const res = await exa().search(query, {
    type: "auto",
    contents: { highlights: true },
    systemPrompt:
      "Report only monthly premiums that a page explicitly states. Convert annual figures to monthly by dividing by 12. Omit any price you cannot quote from the page; never estimate.",
    outputSchema: {
      type: "object",
      properties: {
        prices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              insurer: { type: "string" },
              monthly: { type: "number" },
              quote: { type: "string" },
              url: { type: "string" },
            },
            required: ["monthly", "quote", "url"],
          },
        },
      },
      required: ["prices"],
    },
  });
  const content = res.output?.content;
  const raw = typeof content === "string" ? safeParse(content) : content;
  const prices = Array.isArray((raw as { prices?: unknown[] })?.prices) ? ((raw as { prices: ExtractedPrice[] }).prices ?? []) : [];
  const citations = (res.output?.grounding ?? []).flatMap((g) => g.citations);
  return {
    prices: prices.map((p) => ({ monthly: typeof p.monthly === "number" ? p.monthly : null, insurer: p.insurer ?? null, quote: p.quote ?? "", url: p.url ?? "" })),
    citations,
  };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface PageRead {
  url: string;
  title: string;
  text: string;
  liveViewUrl?: string;
}

export async function kernelRead(url: string, waitMs = 2500): Promise<PageRead> {
  if (!process.env.KERNEL_API_KEY) throw new Error("KERNEL_API_KEY is not set");
  const kernel = new Kernel({ apiKey: process.env.KERNEL_API_KEY });
  const browser = await kernel.browsers.create({ headless: true, stealth: true, timeout_seconds: 120 });
  try {
    const code = `await page.goto(${JSON.stringify(url)}, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(${Math.max(0, Math.min(waitMs, 15000))});
const title = await page.title();
const text = await page.evaluate(() => document.body ? document.body.innerText : "");
return { title, text: text.replace(/\\n{3,}/g, "\\n\\n").slice(0, 12000) };`;
    const res = await kernel.browsers.playwright.execute(browser.session_id, { code, timeout_sec: 60 });
    if (!res.success) throw new Error(`Kernel page read failed: ${res.error ?? res.stderr ?? "unknown error"}`);
    const out = (res.result ?? {}) as { title?: string; text?: string };
    return { url, title: out.title ?? "", text: out.text ?? "", liveViewUrl: browser.browser_live_view_url ?? undefined };
  } finally {
    await kernel.browsers.deleteByID(browser.session_id).catch(() => {});
  }
}
