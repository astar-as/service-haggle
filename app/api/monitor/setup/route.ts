import { createExaMonitors } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { webhookUrl?: string };
  const base = process.env.PUBLIC_URL ?? new URL(req.url).origin;
  const webhookUrl = body.webhookUrl ?? `${base.replace(/\/+$/, "")}/api/monitor/webhook`;
  try {
    return Response.json({ webhookUrl, monitors: await createExaMonitors(webhookUrl) });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
