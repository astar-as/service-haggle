import {
  DEFAULT_MODEL,
  DEFAULT_VOICE,
  endpoints,
  readAnswerSdp,
  readSessionId,
  sessionConfig,
  sipTransport,
  webrtcTransport,
  type SipTrunk,
} from "./protocol";

export class VoiceError extends Error {
  constructor(
    message: string,
    public status = 500,
    public code = "voice_error",
  ) {
    super(message);
  }
}

export function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key || /^sk-x+$/.test(key)) throw new VoiceError("OPENAI_API_KEY is not set on the server", 503, "missing_api_key");
  return key;
}

export function liveModel() {
  return process.env.OPENAI_LIVE_MODEL || DEFAULT_MODEL;
}

export function liveVoice() {
  return process.env.OPENAI_LIVE_VOICE || DEFAULT_VOICE;
}

export function configFor(instructions: string, forAccept = false) {
  return sessionConfig({ model: liveModel(), voice: liveVoice(), instructions }, forAccept);
}

async function post(url: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {}
  if (!res.ok) {
    const err = (json as { error?: { message?: string; code?: string } } | undefined)?.error;
    throw new VoiceError(err?.message || text || `OpenAI request failed (${res.status})`, res.status, err?.code || "openai_error");
  }
  return json;
}

export async function createWebrtcSession(sdp: string, instructions: string) {
  const body = await post(endpoints.sessions, { session: configFor(instructions), transport: webrtcTransport(sdp) });
  const sessionId = readSessionId(body);
  const answer = readAnswerSdp(body);
  if (!sessionId || !answer) throw new VoiceError("Live session response missing session id or SDP answer", 502, "bad_response");
  return { sessionId, sdp: answer };
}

export function sipTrunkFromEnv(): SipTrunk | null {
  const providerUrl = process.env.SIP_PROVIDER_URL;
  const username = process.env.SIP_USERNAME;
  const password = process.env.SIP_PASSWORD;
  const callerNumber = process.env.SIP_CALLER_NUMBER;
  if (!providerUrl || !username || !password || !callerNumber) return null;
  return { providerUrl, username, password, callerNumber };
}

export async function createSipSession(destination: string, instructions: string, trunk: SipTrunk) {
  const body = await post(endpoints.sessions, { session: configFor(instructions), transport: sipTransport(destination, trunk) });
  const sessionId = readSessionId(body);
  if (!sessionId) throw new VoiceError("Live SIP session response missing session id", 502, "bad_response");
  return { sessionId };
}

export async function acceptSession(sessionId: string, instructions: string) {
  await post(endpoints.accept(sessionId), { session: configFor(instructions, true) });
}

export async function rejectSession(sessionId: string, statusCode = 603) {
  await post(endpoints.reject(sessionId), { status_code: statusCode });
}

export async function hangupSession(sessionId: string) {
  await post(endpoints.hangup(sessionId));
}

export function errorResponse(err: unknown) {
  if (err instanceof VoiceError) return Response.json({ error: err.message, code: err.code }, { status: err.status });
  console.error("[live]", err);
  return Response.json({ error: err instanceof Error ? err.message : String(err), code: "internal_error" }, { status: 500 });
}
