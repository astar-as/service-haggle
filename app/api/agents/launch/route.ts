import { callTargets, launchAll, launchRound, type CallTarget } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { policyId?: string; channel?: "browser" | "phone"; targets?: CallTarget[] };
  try {
    if (body.policyId) {
      const calls = await launchRound(body.policyId, body.targets ?? callTargets()[body.policyId] ?? [], body.channel);
      return Response.json({ calls });
    }
    return Response.json({ calls: await launchAll() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
