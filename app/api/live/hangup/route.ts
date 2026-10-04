import { hangupCall } from "@/lib/voice/calls";
import { errorResponse, VoiceError } from "@/lib/voice/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { callId?: string };
    if (!body.callId) throw new VoiceError("callId is required", 400, "bad_request");
    return Response.json({ ok: true, ...(await hangupCall(body.callId)) });
  } catch (err) {
    return errorResponse(err);
  }
}
