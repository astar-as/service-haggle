import Kernel from "@onkernel/sdk";
import { insurerBySlug, insurerSlug, retentionOffer } from "./insurers";
import { store } from "./store";
import type { Policy, PriceCandidate } from "./types";

// "Try to quit": start the insurer's online cancel flow, read the "sad to see you go" offer,
// and stop. The probe only ever selects a reason and presses Continue; it never declines the
// offer, never types CANCEL and never presses the final confirm button.

export interface RetentionProbe {
  policyId: string;
  insurer: string;
  via: "kernel" | "portal-api";
  offer: { monthly: number; percentOff: number; months: number; headline?: string } | null;
  liveViewUrl?: string;
  url: string;
  at: string;
}

const baseUrl = () =>
  process.env.PUBLIC_BASE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://service-haggle.vercel.app");

export async function probeRetention(policyId: string): Promise<RetentionProbe> {
  const policy = await store.policy(policyId);
  if (!policy) throw new Error(`Unknown policy ${policyId}`);
  const slug = insurerSlug(policy.insurer);
  const insurer = insurerBySlug(slug);
  if (!insurer) throw new Error(`No portal for ${policy.insurer}`);
  const url = `${baseUrl()}/insurers/${slug}/cancel`;

  const probe = process.env.KERNEL_API_KEY
    ? await viaKernel(policy, url).catch((e) => {
        console.error("[retention] kernel probe failed, using portal API:", e);
        return viaPortal(policy, url);
      })
    : viaPortal(policy, url);

  await record(policy, probe);
  return probe;
}

// Same flow without a browser: the portal's reason step returns the offer.
function viaPortal(policy: Policy, url: string): RetentionProbe {
  const insurer = insurerBySlug(insurerSlug(policy.insurer))!;
  return {
    policyId: policy.id,
    insurer: policy.insurer,
    via: "portal-api",
    offer: retentionOffer(policy, insurer),
    url,
    at: new Date().toISOString(),
  };
}

async function viaKernel(policy: Policy, url: string): Promise<RetentionProbe> {
  const kernel = new Kernel({ apiKey: process.env.KERNEL_API_KEY! });
  const browser = await kernel.browsers.create({
    headless: false,
    stealth: true,
    timeout_seconds: 180,
  });
  try {
    const code = `await page.goto(${JSON.stringify(url)}, { waitUntil: "networkidle", timeout: 30000 });
await page.click("#reason-price");
await page.waitForTimeout(800);
await page.click("#continue");
const step = await page.waitForSelector('[data-step="offer"], [data-step="confirm"]', { timeout: 20000 });
const name = await step.getAttribute("data-step");
await page.waitForTimeout(2500);
if (name !== "offer") return { offer: null };
const el = await page.$("[data-retention-offer]");
return { offer: {
  monthly: Number(await el.getAttribute("data-monthly")),
  percentOff: Number(await el.getAttribute("data-percent")),
  months: Number(await el.getAttribute("data-months")),
  headline: (await el.innerText()).split("\\n")[0],
} };`;
    if (/confirm-cancel|confirm-input|decline-offer/.test(code))
      throw new Error("Probe must never touch the confirm step");
    const res = await kernel.browsers.playwright.execute(browser.session_id, {
      code,
      timeout_sec: 90,
    });
    if (!res.success) throw new Error(res.error ?? res.stderr ?? "Kernel run failed");
    const out = (res.result ?? {}) as { offer: RetentionProbe["offer"] };
    return {
      policyId: policy.id,
      insurer: policy.insurer,
      via: "kernel",
      offer: out.offer,
      liveViewUrl: browser.browser_live_view_url ?? undefined,
      url,
      at: new Date().toISOString(),
    };
  } finally {
    await kernel.browsers.deleteByID(browser.session_id).catch(() => {});
  }
}

async function record(policy: Policy, probe: RetentionProbe) {
  if (!probe.offer) return;
  const o = probe.offer;
  const price: PriceCandidate = {
    id: `price-${policy.id}-retention-portal`,
    policyId: policy.id,
    insurer: policy.insurer,
    source: "retention",
    monthly: o.monthly,
    obtainable: true,
    basis: `retention offer in ${policy.insurer}'s online cancel flow, ${o.percentOff}% off for ${o.months} months (stopped before confirming)`,
    url: probe.url,
    at: probe.at,
  };
  await store.putPrice(price);
  await store.addSignal({
    id: `sig-retention-${policy.id}-${o.monthly}`,
    personId: policy.personId,
    policyId: policy.id,
    at: probe.at.slice(0, 10),
    source: "kernel",
    title: `Started cancelling online and stopped before confirming: ${policy.insurer} offered $${o.monthly}/mo for ${o.months} months to stay.`,
    url: probe.url,
    impactMonthly: o.monthly - policy.monthlyPremium,
  });
}

export async function probeAll() {
  const policies = (await store.policies()).filter(
    (p) => insurerBySlug(insurerSlug(p.insurer))?.retention,
  );
  return Promise.allSettled(policies.map((p) => probeRetention(p.id)));
}
