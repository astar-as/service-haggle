export const API_BASE = "https://api.openai.com/v1";
export const WS_BASE = process.env.OPENAI_LIVE_WS_BASE || "wss://api.openai.com/v1";
export const DATA_CHANNEL_LABEL = "oai-events";
export const DEFAULT_MODEL = "gpt-live-1";
export const DEFAULT_VOICE = "marin";

export const endpoints = {
  sessions: `${API_BASE}/live/sessions`,
  accept: (sessionId: string) => `${API_BASE}/live/sessions/${encodeURIComponent(sessionId)}/accept`,
  reject: (sessionId: string) => `${API_BASE}/live/sessions/${encodeURIComponent(sessionId)}/reject`,
  hangup: (sessionId: string) => `${API_BASE}/live/sessions/${encodeURIComponent(sessionId)}/hangup`,
  attach: (sessionId: string) => `${WS_BASE}/live/sessions/${encodeURIComponent(sessionId)}/attach`,
};

export const ServerEvent = {
  sessionStarted: "session.started",
  sessionClosed: "session.closed",
  inputTranscriptDelta: "session.input_transcript.delta",
  outputTranscriptDelta: "session.output_transcript.delta",
  delegationCreated: "session.delegation.created",
  instructionsAppended: "session.instructions.appended",
  thinkingAppended: "session.thinking.appended",
  commentaryAppended: "session.commentary.appended",
  transportRinging: "transport.ringing",
  transportAnswered: "transport.answered",
  transportFailed: "transport.failed",
  usageUpdated: "session.usage.updated",
  inputAudioAppend: "session.input_audio.append",
  outputAudioDelta: "session.output_audio.delta",
  error: "error",
} as const;

export const ClientEvent = {
  close: "session.close",
  instructionsAppend: "session.instructions.append",
  thinkingAppend: "session.thinking.append",
  commentaryAppend: "session.commentary.append",
} as const;

export const WebhookEvent = {
  incoming: ["live.transport.incoming", "live.call.incoming"] as readonly string[],
};

export const OUTBOUND_SIP_NOT_ENABLED = "outbound_sip_not_enabled";

export interface ReflectedAudio {
  direction: "in" | "out";
  audio: string;
  startMs?: number;
}

export function readReflectedAudio(e: LiveEvent): ReflectedAudio | null {
  if (e.type === ServerEvent.inputAudioAppend && typeof e.audio === "string") return { direction: "in", audio: e.audio };
  if (e.type === ServerEvent.outputAudioDelta && typeof e.delta === "string")
    return { direction: "out", audio: e.delta, startMs: e.start_ms };
  return null;
}

export const REFLECTED_AUDIO_SAMPLE_RATE = 24000;

export interface LiveEvent {
  type: string;
  event_id?: string;
  client_event_id?: string;
  delta?: string;
  start_ms?: number;
  end_ms?: number;
  reason?: string;
  delegation?: { id: string; type?: string; target?: string };
  error?: { code?: string; message?: string; type?: string };
  session?: { id?: string };
  [key: string]: unknown;
}

export interface SessionConfigInput {
  model: string;
  voice: string;
  instructions: string;
}

export function sessionConfig({ model, voice, instructions }: SessionConfigInput, forAccept = false) {
  return {
    ...(forAccept ? { type: "live" } : {}),
    model,
    instructions,
    audio: { output: { voice } },
    delegation: { type: "client" },
  };
}

export function webrtcTransport(sdp: string) {
  return { type: "webrtc", sdp };
}

export interface SipTrunk {
  providerUrl: string;
  username: string;
  password: string;
  callerNumber: string;
}

export function sipTransport(destination: string, trunk: SipTrunk) {
  return {
    type: "sip",
    destination,
    trunk: {
      provider_url: trunk.providerUrl,
      auth: { type: "digest", username: trunk.username, password: trunk.password },
      caller_number: trunk.callerNumber,
    },
  };
}

export function readSessionId(body: unknown): string | undefined {
  const b = body as { session?: { id?: string }; id?: string } | undefined;
  return b?.session?.id ?? b?.id;
}

export function readAnswerSdp(body: unknown): string | undefined {
  const b = body as { transport?: { sdp?: string }; sdp?: string } | undefined;
  return b?.transport?.sdp ?? b?.sdp;
}

export type AppendKind = "instructions" | "thinking" | "commentary";

export function appendEvent(kind: AppendKind, content: string, delegationId: string | null, eventId: string) {
  const type =
    kind === "instructions"
      ? ClientEvent.instructionsAppend
      : kind === "thinking"
        ? ClientEvent.thinkingAppend
        : ClientEvent.commentaryAppend;
  return { type, event_id: eventId, delegation_id: delegationId, content };
}

export function closeEvent(eventId = "close") {
  return { type: ClientEvent.close, event_id: eventId };
}

export interface IncomingWebhook {
  sessionId?: string;
  sipHeaders: { name: string; value: string }[];
}

export function readIncomingWebhook(event: { type?: string; data?: Record<string, unknown> }): IncomingWebhook | null {
  if (!event.type || !WebhookEvent.incoming.includes(event.type)) return null;
  const data = event.data ?? {};
  const sessionId = (data.session_id ?? data.call_id) as string | undefined;
  const sipHeaders = Array.isArray(data.sip_headers) ? (data.sip_headers as { name: string; value: string }[]) : [];
  return { sessionId, sipHeaders };
}

export const CALL_HEADER = "X-Call-Id";

export function openAiSipUri(projectId: string, callId: string) {
  const host = process.env.OPENAI_SIP_HOST || "sip.api.openai.com";
  const params = process.env.OPENAI_SIP_PARAMS ?? ";transport=tls;secure=true";
  return `sip:${projectId}@${host}${params}?${CALL_HEADER}=${encodeURIComponent(callId)}`;
}
