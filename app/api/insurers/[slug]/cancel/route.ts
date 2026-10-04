import { insurerBySlug, retentionOffer } from "@/lib/insurers";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The mock insurer's cancel flow. step "reason" returns the retention offer; step "confirm"
// requires typing CANCEL. Confirming is a no-op in the mock, and the agent never calls it.
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const insurer = insurerBySlug(slug);
  if (!insurer) return Response.json({ error: "Unknown insurer" }, { status: 404 });
  const policy = (await store.policies()).find((p) => p.insurer === insurer.name);
  if (!policy) return Response.json({ error: "No policy with this insurer" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    step?: string;
    reason?: string;
    typed?: string;
  };
  if (body.step === "reason") {
    return Response.json({
      insurer: insurer.name,
      premium: policy.monthlyPremium,
      offer: retentionOffer(policy, insurer),
    });
  }
  if (body.step === "confirm") {
    if (body.typed !== "CANCEL")
      return Response.json({ error: "Type CANCEL to confirm" }, { status: 400 });
    return Response.json({ cancelled: true, note: "Mock portal: nothing was cancelled." });
  }
  return Response.json({ error: "Unknown step" }, { status: 400 });
}
