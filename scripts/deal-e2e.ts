// End-to-end check of the close-the-deal flow against real AgentMail (in-memory store).
// Usage: npx tsx --env-file=.env scripts/deal-e2e.ts   (sends ~8 real emails)
import { releaseDeal, signDeal, startDeal } from "@/lib/deal";
import { store } from "@/lib/store";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(id: string, statuses: string[], label: string) {
  const t = Date.now();
  for (;;) {
    const d = (await store.deal(id))!;
    if (statuses.includes(d.status)) {
      console.log(`✓ ${label}: ${d.status} (${((Date.now() - t) / 1000).toFixed(0)}s)`);
      return d;
    }
    if (d.status === "failed") throw new Error(`failed: ${d.note}`);
    await sleep(1000);
  }
}
async function main() {
  const deal = await startDeal({ policyId: "auto-northstar", monthly: 185 });
  console.log("deal", deal.id, deal.ref, deal.inbox, "->", deal.desk);
  let d = await until(deal.id, ["awaiting_release"], "confirm + binding request + draft");
  console.log("  requested:", d.requested.map((r) => `${r.label}=${r.masked}`).join(", "));
  await releaseDeal(deal.id);
  d = await until(deal.id, ["awaiting_signature"], "release + contract + check (+ correction)");
  console.log(
    "  contract:",
    d.contract?.filename,
    d.contract?.checks.map((c) => `${c.label}:${c.ok ? "ok" : "BAD " + c.found}`).join(", "),
  );
  await signDeal(deal.id, "Maya Okafor");
  d = await until(deal.id, ["bound"], "sign + receipt + bound");
  console.log("  receipt:", d.receipt);
  console.log("\nTimeline:");
  for (const m of d.mails)
    console.log(
      `  ${m.direction.padEnd(5)} ${m.labels.join(",").padEnd(28)} ${m.attachment ? "📎 " + m.attachment + " " : ""}${m.summary}`,
    );
  const p = await store.policy("auto-northstar");
  const s = await store.stance("auto-northstar");
  console.log(
    "\npolicy now",
    p?.monthlyPremium,
    p?.facts.find((f) => f.label === "Policy number"),
    "| stance",
    s?.verdict,
    s?.headline,
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
