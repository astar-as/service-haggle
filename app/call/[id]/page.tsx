import { notFound, redirect } from "next/navigation";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await store.call(id);
  if (!call) notFound();
  redirect(`/negotiation/${call.policyId}?line=${encodeURIComponent(id)}`);
}
