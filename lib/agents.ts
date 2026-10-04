import { keepAlive } from "./background";
import { withdraw } from "./pool";
import { store } from "./store";
import type { Call } from "./types";

export interface CallTarget {
  phone?: string;
  email?: string;
  slot?: string;
  name: string;
  insurer?: string;
}

export const DEMO_TARGETS: Record<string, CallTarget[]> = {
  "auto-northstar": [
    { slot: "1", name: "Jordan", insurer: "Northstar Mutual" },
    { slot: "2", name: "Priya", insurer: "Bayline Auto" },
    { slot: "3", name: "Sam", insurer: "Harbor & Pine" },
    { email: "goldengate-broker@agentmail.to", name: "Dana Kim", insurer: "Golden Gate Mutual" },
    { email: "redwood-broker@agentmail.to", name: "Sam Ortiz", insurer: "Redwood Direct" },
  ],
};

export function callTargets(): Record<string, CallTarget[]> {
  try {
    const raw = JSON.parse(process.env.CALL_TARGETS ?? "{}") as Record<
      string,
      CallTarget | CallTarget[]
    >;
    const parsed = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v : [v]]),
    );
    return Object.keys(parsed).length ? parsed : DEMO_TARGETS;
  } catch {
    return DEMO_TARGETS;
  }
}

function channelFor(t: CallTarget): Call["channel"] {
  if (t.email) return "email";
  if (t.phone) return "phone";
  return "browser";
}

function targetFor(t: CallTarget) {
  if (t.email) return `mailto:${t.email}`;
  if (t.phone) return t.phone;
  if (t.slot) return `slot:${t.slot}`;
  return undefined;
}

const flyConfigured = () =>
  !!(process.env.FLY_API_TOKEN && process.env.FLY_APP_NAME && process.env.FLY_IMAGE_REF);

async function launchFlyMachine(callId: string) {
  const res = await fetch(`https://api.machines.dev/v1/apps/${process.env.FLY_APP_NAME}/machines`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `negotiator-${callId}`.slice(0, 60),
      region: process.env.FLY_REGION,
      config: {
        image: process.env.FLY_IMAGE_REF,
        env: { CALL_ID: callId, ROLE: "negotiator" },
        init: { cmd: ["npx", "tsx", "worker/negotiate.ts"] },
        auto_destroy: true,
        restart: { policy: "no" },
        guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
        metadata: { role: "negotiator", call_id: callId },
      },
    }),
  });
  if (!res.ok) throw new Error(`Fly Machines API ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

async function runInProcess(call: Call) {
  const callId = call.id;
  const run =
    call.channel === "email"
      ? (await import("./email/negotiator")).runEmailNegotiation
      : (await import("./voice/negotiator")).runNegotiation;
  keepAlive(
    run(callId).catch(async (e: unknown) => {
      const call = await store.call(callId);
      if (call)
        await store.putCall({ ...call, status: "ended", endedAt: new Date().toISOString() });
      console.error(`[negotiator ${callId}]`, e);
    }),
  );
}

async function start(call: Call) {
  await store.putCall(call);
  const receiver = call.channel === "browser" && call.target?.startsWith("slot:");
  if (call.channel === "browser" && !receiver) return call;
  if (flyConfigured() && Number(process.env.FLY_POOL_SIZE ?? 0) > 0) {
    await store.putCall({ ...call, claimable: true });
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 300));
      const fresh = await store.call(call.id);
      if (fresh?.machineId) return fresh;
    }
    if (!(await withdraw(call.id))) return (await store.call(call.id)) ?? call;
  }
  if (flyConfigured()) {
    const machineId = await launchFlyMachine(call.id);
    const withMachine = { ...call, machineId };
    await store.putCall(withMachine);
    return withMachine;
  }
  if (!receiver) await runInProcess(call);
  return call;
}

export async function launchRound(
  policyId: string,
  targets: CallTarget[],
  channel?: Call["channel"],
) {
  const policy = await store.policy(policyId);
  if (!policy) throw new Error(`Unknown policy ${policyId}`);
  const roundId = `round-${policyId}-${Date.now().toString(36)}`;
  const list: CallTarget[] = targets.length ? targets : [{ name: "", insurer: policy.insurer }];
  return Promise.all(
    list.map((t, i) => {
      const insurer = t.insurer ?? policy.insurer;
      return start({
        id: `${roundId}-${i}`,
        roundId,
        policyId,
        insurer,
        role: insurer === policy.insurer ? "retention" : "quote",
        status: "dialing",
        channel: channel ?? channelFor(t),
        target: targetFor(t),
        counterpart: t.name ? `${t.name} · ${insurer}` : insurer,
        startedAt: new Date().toISOString(),
        citing: [],
        transcript: [],
      });
    }),
  );
}

export async function launchAll() {
  const targets = callTargets();
  const ids = Object.keys(targets);
  if (!ids.length) {
    const open = (await store.stances())
      .filter((s) => s.verdict === "overpaying")
      .map((s) => s.policyId);
    if (!open.length) throw new Error("Nothing needs negotiating and CALL_TARGETS is empty.");
    return (await Promise.all(open.map((id) => launchRound(id, [], "browser")))).flat();
  }
  const active = new Set(
    (await store.calls()).filter((c) => c.status !== "ended").map((c) => c.policyId),
  );
  return (
    await Promise.all(ids.filter((id) => !active.has(id)).map((id) => launchRound(id, targets[id])))
  ).flat();
}

export async function competingOffers(callId: string) {
  const self = await store.call(callId);
  if (!self) return [];
  return (await store.calls())
    .filter(
      (c) =>
        c.id !== callId &&
        c.policyId === self.policyId &&
        c.roundId === self.roundId &&
        (c.theirOffer ?? c.agreedMonthly) !== undefined,
    )
    .map((c) => ({
      callId: c.id,
      insurer: c.insurer,
      monthly: (c.agreedMonthly ?? c.theirOffer)!,
      live: c.status !== "ended",
      agreed: c.agreedMonthly !== undefined,
    }))
    .sort((a, b) => a.monthly - b.monthly);
}
