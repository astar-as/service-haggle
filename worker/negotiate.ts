import { store } from "../lib/store";
import { runEmailNegotiation } from "../lib/email/negotiator";
import { runNegotiation } from "../lib/voice/negotiator";

const callId = process.env.CALL_ID;
if (!callId) {
  console.error("CALL_ID is required");
  process.exit(1);
}

async function main(id: string) {
  const call = await store.call(id);
  if (!call) throw new Error(`Call ${id} not found`);
  await (call.channel === "email" ? runEmailNegotiation(id) : runNegotiation(id));
}

main(callId)
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(`[negotiator ${callId}]`, e);
    process.exit(1);
  });
