import { runNegotiation } from "../lib/voice/negotiator";

const callId = process.env.CALL_ID;
if (!callId) {
  console.error("CALL_ID is required");
  process.exit(1);
}

runNegotiation(callId)
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(`[negotiator ${callId}]`, e);
    process.exit(1);
  });
