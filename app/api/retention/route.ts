import { probeAll, probeRetention } from "@/lib/retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST { policyId? }: start cancelling online, record the retention offer, stop before confirming.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { policyId?: string };
  if (body.policyId) return Response.json({ probes: [await probeRetention(body.policyId)] });
  const settled = await probeAll();
  return Response.json({
    probes: settled.map((r) => (r.status === "fulfilled" ? r.value : { error: String(r.reason) })),
  });
}
