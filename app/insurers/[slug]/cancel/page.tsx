import { notFound } from "next/navigation";
import { CancelFlow } from "@/components/cancel-flow";
import { insurerBySlug } from "@/lib/insurers";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

// Mock self-service portal for a fictional insurer, used by the retention probe.
export default async function CancelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const insurer = insurerBySlug(slug);
  if (!insurer) notFound();
  const policy = (await store.policies()).find((p) => p.insurer === insurer.name);
  if (!policy) notFound();

  return (
    <main className="min-h-dvh bg-white text-[#1b1d21]">
      <header className="px-5 py-4 text-white" style={{ background: insurer.accent }}>
        <div className="mx-auto max-w-[560px] text-[17px] font-semibold">
          {insurer.name} · My account
        </div>
      </header>
      <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold">Cancel your policy</h1>
          <p className="text-[15px] text-[#5b6070]">
            {policy.product} · ${policy.monthlyPremium}/mo · policy holder{" "}
            {policy.personId === "maya" ? "Maya Okafor" : policy.personId}
          </p>
        </div>
        <CancelFlow slug={slug} accent={insurer.accent} />
      </div>
    </main>
  );
}
