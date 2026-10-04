import type { Turn } from "./types";

export interface DelegationRequest {
  callId: string;
  policyId: string;
  request: string;
  transcript: Turn[];
}

export interface DelegationResult {
  say: string;
  theirOffer?: number;
  ask?: number;
  agreedMonthly?: number;
  citing?: string[];
  endCall?: boolean;
}

export async function handleDelegation(req: DelegationRequest): Promise<DelegationResult> {
  return { say: `Let me check that for ${req.policyId}.` };
}
