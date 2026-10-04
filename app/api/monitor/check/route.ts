import { checkPolicy, negotiationTargets, today } from "@/lib/monitor";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return Response.json({ targets: await negotiationTargets(), stances: await store.stances() });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { policyId?: string; asOf?: string; research?: boolean };
  const ids = body.policyId ? [body.policyId] : (await store.policies()).map((p) => p.id);
  const results = [];
  for (const id of ids) {
    try {
      const r = await checkPolicy(id, body.asOf ?? today(), { research: body.research });
      results.push({ policyId: id, stance: r.stance, signals: r.signals, findings: r.findings.length, usedModel: r.usedModel });
    } catch (e) {
      results.push({ policyId: id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return Response.json({ results, targets: await negotiationTargets() });
}
