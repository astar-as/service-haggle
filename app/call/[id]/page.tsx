import { notFound } from "next/navigation";
import { RoundView } from "@/components/round-view";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await store.call(id);
  if (!call) notFound();
  const [policy, stance, calls] = await Promise.all([store.policy(call.policyId), store.stance(call.policyId), store.calls()]);
  if (!policy) notFound();
  const round = calls.filter((c) => (call.roundId ? c.roundId === call.roundId : c.id === call.id)).sort((a, b) => a.id.localeCompare(b.id));
  return <RoundView initial={round} selectedId={id} policy={policy} fairMonthly={stance?.fairMonthly} />;
}
