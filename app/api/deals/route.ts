import { hasDealMail, startDeal } from "@/lib/deal";
import { priceBoard } from "@/lib/pricing";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return Response.json({
    deals: (await store.deals()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  });
}

// POST { callId } closes an agreed call; { policyId, monthly?, insurer? } closes a price directly
// (defaults to the cheapest obtainable price in the ledger).
export async function POST(req: Request) {
  if (!hasDealMail())
    return Response.json({ error: "AGENTMAIL_API_KEY is not set" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as {
    callId?: string;
    policyId?: string;
    monthly?: number;
    insurer?: string;
  };
  if (body.callId) {
    const call = await store.call(body.callId);
    const monthly = call?.agreedMonthly ?? call?.theirOffer;
    if (!call || monthly === undefined)
      return Response.json({ error: "Call has no agreed price" }, { status: 400 });
    return Response.json({
      deal: await startDeal({
        policyId: call.policyId,
        monthly,
        insurer: call.insurer,
        callId: call.id,
      }),
    });
  }
  if (!body.policyId)
    return Response.json({ error: "callId or policyId required" }, { status: 400 });
  const best =
    body.monthly === undefined ? (await priceBoard(body.policyId)).bestObtainable : undefined;
  const monthly = body.monthly ?? best?.monthly;
  if (monthly === undefined)
    return Response.json({ error: "No obtainable price to close yet" }, { status: 400 });
  return Response.json({
    deal: await startDeal({
      policyId: body.policyId,
      monthly,
      insurer: body.insurer ?? best?.insurer,
    }),
  });
}
