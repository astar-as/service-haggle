// Scan published insurer prices for every seeded policy and write a snapshot.
// Usage: npx tsx --env-file=.env scripts/market-offers.ts [--fast]
import { writeFileSync, mkdirSync } from "node:fs";
import { policies } from "@/lib/seed";
import { scanAll, type OfferScan } from "@/mastra/offers";

const depth = process.argv.includes("--fast") ? "auto" : "deep";

async function main() {
  const started = Date.now();
  const settled = await scanAll(policies, depth);
  const scans: OfferScan[] = [];

  settled.forEach((r, i) => {
    const policy = policies[i];
    if (r.status === "rejected") {
      console.log(`\n✗ ${policy.kind} (${policy.insurer}): ${r.reason}`);
      return;
    }
    const s = r.value;
    scans.push(s);
    const prices = s.offers.map((o) => o.monthly);
    const range = prices.length
      ? `$${Math.min(...prices)}–$${Math.max(...prices)}/mo`
      : "no prices";
    console.log(
      `\n▸ ${policy.kind.toUpperCase()} · you pay $${policy.monthlyPremium}/mo at ${policy.insurer} · market ${range} · ${s.offers.length} offers from ${s.sources} sources · $${s.costDollars ?? "?"}`,
    );
    for (const o of s.offers)
      console.log(
        `   ${o.insurer.slice(0, 24).padEnd(24)} $${String(o.monthly).padStart(4)}  ${o.appliesTo.slice(0, 56).padEnd(56)} ${new URL(o.url).hostname}`,
      );
  });

  mkdirSync("data", { recursive: true });
  const file = `data/market-offers${depth === "auto" ? "-fast" : ""}.json`;
  writeFileSync(file, JSON.stringify(scans, null, 2));
  console.log(
    `\n${depth} scan of ${policies.length} policies in ${((Date.now() - started) / 1000).toFixed(1)}s → ${file}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
