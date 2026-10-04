import { callTargets, launchAll, launchRound, reachable, type CallTarget } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { policyId?: string; channel?: "browser" | "phone"; targets?: CallTarget[] };
  try {
    if (body.policyId) {
      const targets = body.targets ?? callTargets()[body.policyId] ?? [];
      // A line nobody can answer sits at "dialing" forever and shows as a live negotiation.
      if (!targets.some(reachable)) {
        return Response.json({ error: "Nobody is set up to negotiate this policy yet." }, { status: 400 });
      }
      const calls = await launchRound(body.policyId, targets.filter(reachable), body.channel);
      return Response.json({ calls });
    }
    return Response.json({ calls: await launchAll() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
