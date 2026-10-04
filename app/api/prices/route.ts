import { priceBoard, refreshAll, refreshPrices } from "@/lib/pricing";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET: the price ledger for every policy. GET ?refresh=1 rescans first (used by the cron).
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("refresh")) {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
      return new Response("Unauthorized", { status: 401 });
    await refreshAll();
  }
  const policies = await store.policies();
  return Response.json({ boards: await Promise.all(policies.map((p) => priceBoard(p.id))) });
}

// POST { policyId? }: rescan published prices and campaigns, then return the ledger.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { policyId?: string };
  if (body.policyId) return Response.json({ boards: [await refreshPrices(body.policyId)] });
  await refreshAll();
  const policies = await store.policies();
  return Response.json({ boards: await Promise.all(policies.map((p) => priceBoard(p.id))) });
}
