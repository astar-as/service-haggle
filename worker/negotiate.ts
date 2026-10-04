import { runEmailNegotiation } from "../lib/email/negotiator";
import { claimNext } from "../lib/pool";
import { store } from "../lib/store";
import { runNegotiation } from "../lib/voice/negotiator";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run(id: string) {
  const call = await store.call(id);
  if (!call) throw new Error(`Call ${id} not found`);
  await (call.channel === "email" ? runEmailNegotiation(id) : runNegotiation(id));
}

async function pool(machineId: string) {
  console.log(`[pool ${machineId}] waiting for lines`);
  for (;;) {
    const call = await claimNext(machineId).catch((e: unknown) => {
      console.error(`[pool ${machineId}] claim failed`, e);
      return undefined;
    });
    if (!call) {
      await sleep(400);
      continue;
    }
    console.log(`[pool ${machineId}] claimed ${call.id}`);
    void run(call.id).catch((e: unknown) => console.error(`[negotiator ${call.id}]`, e));
  }
}

const callId = process.env.CALL_ID;
if (callId) {
  run(callId)
    .then(() => process.exit(0))
    .catch((e: unknown) => {
      console.error(`[negotiator ${callId}]`, e);
      process.exit(1);
    });
} else if (process.env.ROLE === "pool") {
  void pool(process.env.FLY_MACHINE_ID ?? "local");
} else {
  console.error("CALL_ID or ROLE=pool is required");
  process.exit(1);
}
