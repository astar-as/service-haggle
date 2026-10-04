import { startPhoneCall } from "@/lib/voice/calls";
import { phoneMode } from "@/lib/voice/negotiator";
import { errorResponse, sipTrunkFromEnv, VoiceError } from "@/lib/voice/openai";
import { twilioFromEnv } from "@/lib/voice/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PhoneRequest {
  callId?: string;
  policyId?: string;
  target?: string;
  insurer?: string;
  counterpart?: string;
  roundId?: string;
}

export async function GET() {
  let mode: string | null = null;
  try {
    mode = phoneMode();
  } catch {}
  return Response.json({
    mode,
    sip: !!sipTrunkFromEnv(),
    twilio: !!twilioFromEnv(),
    apiKey: !!process.env.OPENAI_API_KEY,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as PhoneRequest & { calls?: PhoneRequest[] };
    const list = body.calls?.length ? body.calls : [body];
    const results = [];
    for (const c of list) {
      if (!c.callId && !c.policyId) throw new VoiceError("Provide callId or policyId (+ target)", 400, "bad_request");
      results.push(
        await startPhoneCall({
          callId: c.callId,
          policyId: c.policyId ?? "",
          target: c.target,
          insurer: c.insurer,
          counterpart: c.counterpart,
          roundId: c.roundId ?? body.roundId,
        }),
      );
    }
    return Response.json(body.calls?.length ? { calls: results } : results[0], { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
