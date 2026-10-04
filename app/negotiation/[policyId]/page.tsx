import { notFound } from "next/navigation";
import { LiveRefresh } from "@/components/live-refresh";
import { NegotiationHub } from "@/components/negotiation-hub";
import { canNegotiate } from "@/lib/agents";
import { priceBoard, type PriceBoard } from "@/lib/pricing";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NegotiationPage({
  params,
  searchParams,
}: {
  params: Promise<{ policyId: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const [{ policyId }, { line }] = await Promise.all([params, searchParams]);
  const [policy, stance, calls, person] = await Promise.all([store.policy(policyId), store.stance(policyId), store.calls(), store.person()]);
  if (!policy) notFound();
  let board: PriceBoard | undefined;
  try {
    board = await priceBoard(policyId);
  } catch {
    board = undefined;
  }
  const lines = calls.filter((c) => c.policyId === policyId).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  const latestRound = lines.at(-1)?.roundId;
  const current = latestRound ? lines.filter((c) => c.roundId === latestRound) : lines.slice(-1);
  const earlier = lines.filter((c) => !current.includes(c));

  return (
    <>
      <LiveRefresh />
      <NegotiationHub
        policy={policy}
        stance={stance}
        lines={current}
        earlier={earlier}
        board={board}
        firstName={person.firstName}
        initialLine={line}
        canShop={canNegotiate(policyId)}
      />
    </>
  );
}
