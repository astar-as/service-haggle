import { declineDeal, releaseDeal, signDeal } from "@/lib/deal";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deal = await store.deal((await params).id);
  return deal ? Response.json({ deal }) : Response.json({ error: "Not found" }, { status: 404 });
}

// POST { action: "release" | "decline" | "sign", name? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; name?: string };
  try {
    if (body.action === "release") return Response.json({ deal: await releaseDeal(id) });
    if (body.action === "decline") return Response.json({ deal: await declineDeal(id) });
    if (body.action === "sign") return Response.json({ deal: await signDeal(id, body.name ?? "") });
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
