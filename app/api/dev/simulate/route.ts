import { launchRound } from "@/lib/agents";
import { store } from "@/lib/store";
import type { Call, Turn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Step = [number, Turn["speaker"], string, Partial<Pick<Call, "theirOffer" | "ask" | "agreedMonthly" | "citing">>?];

const SCRIPTS: Step[][] = [
  [
    [1500, "agent", "Hi, I'm an AI assistant calling on behalf of Maya Okafor about her auto renewal."],
    [2500, "counterpart", "Sure, I see it. It renews at $248 a month."],
    [2500, "agent", "Drivers with her profile pay $172 to $198 with you, and she's driving far less since August. Can you get closer to that?", { ask: 178, citing: ["14 drivers like Maya · Lowball network", "Driving less since Aug · bank data"] }],
    [6000, "counterpart", "Best I can do is $205.", { theirOffer: 205 }],
    [4500, "agent", "Another provider just offered $189 for the same cover. Can you beat that?", { citing: ["Bayline offer $189 · live call"] }],
    [4000, "counterpart", "Okay, fine. $185 a month.", { theirOffer: 185 }],
    [2500, "agent", "Thank you, that's great. I'll send a confirmation email right now.", { agreedMonthly: 185 }],
  ],
  [
    [2200, "agent", "Hi, I'm an AI assistant shopping auto insurance for Maya Okafor, 29, clean record, 2019 Civic."],
    [3000, "counterpart", "Happy to quote. For full coverage I can do $214 a month.", { theirOffer: 214 }],
    [4000, "agent", "Her current insurer is at $205 and coming down. Is $214 your best?", { ask: 178, citing: ["Northstar offer $205 · live call"] }],
    [5000, "counterpart", "With the low-mileage discount, $189.", { theirOffer: 189 }],
    [9000, "agent", "Thanks, we've gone with another offer today. I appreciate your time."],
  ],
  [
    [2800, "agent", "Hi, I'm an AI assistant calling for Maya Okafor about a full-coverage auto quote."],
    [3500, "counterpart", "Sure. I can do $229 a month.", { theirOffer: 229 }],
    [4000, "agent", "Another provider is at $205 for the same cover. Can you do better?", { ask: 178, citing: ["Northstar offer $205 · live call"] }],
    [5000, "counterpart", "That's as low as I can go, sorry."],
    [8000, "agent", "Understood. Thanks for your time."],
  ],
];

async function play(callId: string, script: Step[]) {
  let call = (await store.call(callId))!;
  call = { ...call, status: "live" };
  await store.putCall(call);
  for (const [delay, speaker, text, patch] of script) {
    await wait(delay);
    const turn: Turn = { id: `${callId}-${call.transcript.length}`, speaker, text, at: new Date().toISOString(), final: true };
    call = { ...(await store.call(callId))!, ...patch, transcript: [...call.transcript, turn] };
    if (patch?.citing) call.citing = [...new Set([...(call.citing ?? []), ...patch.citing])];
    await store.putCall(call);
  }
  await wait(1500);
  await store.putCall({ ...(await store.call(callId))!, status: "ended", endedAt: new Date().toISOString() });
}

export async function POST() {
  if (process.env.NODE_ENV === "production") return Response.json({ error: "dev only" }, { status: 404 });
  const calls = await launchRound(
    "auto-northstar",
    [
      { phone: "", name: "Jordan", insurer: "Northstar Mutual" },
      { phone: "", name: "Priya", insurer: "Bayline Auto" },
      { phone: "", name: "Sam", insurer: "Harbor & Pine" },
    ],
    "browser",
  );
  calls.forEach((c, i) => void play(c.id, SCRIPTS[i]));
  return Response.json({ calls: calls.map((c) => c.id) });
}
