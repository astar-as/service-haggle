import { VoiceError } from "./openai";
import { openAiSipUri } from "./protocol";

interface TwilioEnv {
  accountSid: string;
  authToken: string;
  from: string;
  projectId: string;
}

export function twilioFromEnv(): TwilioEnv | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const projectId = process.env.OPENAI_PROJECT_ID;
  if (!accountSid || !authToken || !from || !projectId) return null;
  return { accountSid, authToken, from, projectId };
}

function xml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function twilio(env: TwilioEnv, path: string, params: Record<string, string>) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.accountSid}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.accountSid}:${env.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok) throw new VoiceError(`Twilio: ${json.message || res.statusText}`, 502, `twilio_${json.code ?? res.status}`);
  return json;
}

export async function placeTwilioCall(to: string, callId: string) {
  const env = twilioFromEnv();
  if (!env) throw new VoiceError("Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, OPENAI_PROJECT_ID)", 501, "twilio_not_configured");
  const twiml = `<Response><Dial><Sip>${xml(openAiSipUri(env.projectId, callId))}</Sip></Dial></Response>`;
  const json = await twilio(env, "/Calls.json", { To: to, From: env.from, Twiml: twiml });
  if (!json.sid) throw new VoiceError("Twilio did not return a call sid", 502, "twilio_bad_response");
  return json.sid;
}

export async function endTwilioCall(callSid: string) {
  const env = twilioFromEnv();
  if (!env) return;
  await twilio(env, `/Calls/${callSid}.json`, { Status: "completed" }).catch((e) => console.error("[live] twilio hangup", e));
}
