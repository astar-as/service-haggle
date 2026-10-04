import { acceptIncoming } from "@/lib/voice/calls";
import { voiceState } from "@/lib/voice/context";
import { readIncomingWebhook } from "@/lib/voice/protocol";
import { verifyWebhook } from "@/lib/voice/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyWebhook(raw, req.headers)) return Response.json({ error: "Invalid signature" }, { status: 400 });
  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const deliveryId = req.headers.get("webhook-id");
  const { webhooks } = voiceState();
  if (deliveryId) {
    if (webhooks.has(deliveryId)) return Response.json({ ok: true, duplicate: true });
    webhooks.add(deliveryId);
  }
  const incoming = readIncomingWebhook(event);
  if (!incoming) return Response.json({ ok: true, ignored: event.type ?? null });
  if (!incoming.sessionId) return Response.json({ error: "Missing session id" }, { status: 400 });
  void acceptIncoming(incoming.sessionId, incoming.sipHeaders).catch((e) => console.error("[live] accept failed", e));
  return Response.json({ ok: true });
}
