// Refresh and print the price ledger for every policy.
// Usage: npx tsx --env-file=.env scripts/prices.ts [policyId]
import { priceBoard, refreshAll, refreshPrices } from "@/lib/pricing";
import { getBrief } from "@/lib/strategist";
import { store } from "@/lib/store";

async function main() {
  const only = process.argv[2];
  const started = Date.now();
  if (only) await refreshPrices(only);
  else await refreshAll();
  for (const p of await store.policies()) {
    if (only && p.id !== only) continue;
    const b = await priceBoard(p.id);
    const fmt = (c?: { insurer: string; monthly: number; source: string }) =>
      c ? `${c.insurer} $${c.monthly} (${c.source})` : "none";
    console.log(
      `\n▸ ${p.kind.toUpperCase()} pays $${b.premium} · best estimate ${fmt(b.bestEstimate)} · best obtainable ${fmt(b.bestObtainable)}`,
    );
    for (const c of b.candidates.slice(0, 8))
      console.log(
        `   ${c.source.padEnd(9)} ${c.insurer.slice(0, 22).padEnd(22)} $${String(c.monthly).padStart(4)}  ${c.basis.slice(0, 80)}`,
      );
  }
  const signals = (await store.signals()).filter((s) => s.id.startsWith("sig-price-"));
  console.log(`\nSignals:\n${signals.map((s) => `   ${s.title}`).join("\n")}`);
  const brief = await getBrief("auto-northstar");
  console.log(
    `\nAuto brief evidence:\n${brief.evidence.map((e) => `   [${e.kind}] ${e.say}`).join("\n")}`,
  );
  console.log(`\n${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
