import { loadCall, onReflectedAudio, voiceState } from "@/lib/voice/context";
import { readReflectedAudio, type ReflectedAudio } from "@/lib/voice/protocol";
import { Sideband } from "@/lib/voice/sideband";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const callId = new URL(req.url).searchParams.get("callId");
  if (!callId) return Response.json({ error: "callId is required" }, { status: 400 });
  const local = voiceState().active.has(callId);
  const call = await loadCall(callId);
  const attachOwn = !local && process.env.VOICE_LISTEN_ATTACH === "1" && !!call?.sessionId;
  if (!local && !attachOwn)
    return Response.json({ error: "Call audio is not available in this process", code: "not_local" }, { status: 404 });
  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (a: ReflectedAudio) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ d: a.direction, a: a.audio, t: a.startMs })}\n\n`));
        } catch {}
      };
      controller.enqueue(enc.encode(`event: ready\ndata: {"sampleRate":24000}\n\n`));
      const ping = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {}
      }, 15000);
      if (attachOwn) {
        const sb = new Sideband(call!.sessionId!, (e) => {
          const a = readReflectedAudio(e);
          if (a) send(a);
          if (e.type === "session.closed") controller.close();
        }, () => {
          try {
            controller.close();
          } catch {}
        });
        cleanup = () => {
          clearInterval(ping);
          sb.close();
        };
        await sb.connect().catch(() => controller.close());
      } else {
        const off = onReflectedAudio(callId, send);
        cleanup = () => {
          clearInterval(ping);
          off();
        };
      }
    },
    cancel() {
      cleanup();
    },
  });
  req.signal.addEventListener("abort", () => cleanup());
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
