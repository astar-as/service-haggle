import { notFound } from "next/navigation";
import { DealView } from "@/components/deal-view";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, person] = await Promise.all([store.deal(id), store.person()]);
  if (!deal) notFound();
  const policy = await store.policy(deal.policyId);
  if (!policy) notFound();
  return (
    <DealView
      initial={deal}
      personName={person.name}
      firstName={person.firstName}
      product={policy.product}
      kind={String(policy.kind)}
    />
  );
}
