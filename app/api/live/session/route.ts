import { startBrowserCall } from "@/lib/voice/calls";
import { errorResponse, VoiceError } from "@/lib/voice/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { sdp?: string; policyId?: string; callId?: string };
    if (typeof body.sdp !== "string" || !body.sdp.trim()) throw new VoiceError("An SDP offer is required", 400, "bad_request");
    const result = await startBrowserCall({ sdp: body.sdp, policyId: body.policyId, callId: body.callId });
    return Response.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
