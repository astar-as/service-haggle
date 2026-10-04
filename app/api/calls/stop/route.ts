import { store } from "@/lib/store";
import { hangupCall } from "@/lib/voice/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {callId?, policyId?}: end live lines. The voice and email agents watch their Call doc and shut down once it's ended.
// No body ends every live line.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { callId?: string; policyId?: string };
  const live = (await store.calls()).filter(
    (c) =>
      c.status !== "ended" &&
      (!body.callId || c.id === body.callId) &&
      (!body.policyId || c.policyId === body.policyId),
  );
  const results = await Promise.all(
    live.map(async (c) => {
      try {
        return { callId: c.id, ...(await hangupCall(c.id)) };
      } catch (e) {
        // Last resort: mark it ended so the dashboard and the agents let go.
        await store.putCall({ ...c, status: "ended", endedAt: new Date().toISOString() });
        return { callId: c.id, via: "store", error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return Response.json({ stopped: results });
}
