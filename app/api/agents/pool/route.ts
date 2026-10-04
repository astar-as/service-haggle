import { drainPool, ensurePool, poolStatus } from "@/lib/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ machines: await poolStatus() });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { size?: number; drain?: boolean };
  try {
    if (body.drain) return Response.json({ drained: await drainPool() });
    return Response.json(await ensurePool(Math.min(8, Math.max(0, body.size ?? Number(process.env.FLY_POOL_SIZE ?? 3)))));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
