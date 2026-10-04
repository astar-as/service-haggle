import { store } from "@/lib/store";

// Documents for one policy: the current declarations page, and the signed paperwork from the
// latest deal (contract, receipt, issued policy), all as they travelled over email.
export async function PolicyDocuments({ policyId }: { policyId: string }) {
  const [policy, deals] = await Promise.all([store.policy(policyId), store.deals()]);
  if (!policy) return null;
  const deal = deals
    .filter((d) => d.policyId === policyId && d.status === "bound")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const rows: { label: string; note: string; href: string }[] = [
    {
      label: deal?.policyPdf ? "Policy declarations" : "Declarations page",
      note: deal?.policyPdf
        ? `${deal.insurer} · ${deal.receipt?.policyNumber ?? "issued"} · current`
        : `${policy.insurer} · current term`,
      href: `/api/policies/${policyId}/document`,
    },
  ];
  if (deal?.contractPdf)
    rows.push({
      label: "Signed contract",
      note: `${deal.contract?.filename ?? "contract"} · checked against the deal`,
      href: `/api/deals/${deal.id}/pdf?doc=contract`,
    });
  if (deal?.receiptPdf)
    rows.push({
      label: "Signature receipt",
      note: `${deal.receipt?.id} · ${deal.signature?.mode === "autopilot" ? "signed on autopilot" : `signed by ${deal.signature?.name}`}`,
      href: `/api/deals/${deal.id}/pdf?doc=receipt`,
    });

  return (
    <section aria-labelledby="documents" className="flex flex-col gap-3">
      <h2 id="documents" className="px-1 text-[15px] leading-[22px] font-semibold">
        Documents
      </h2>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
        {rows.map((r) => (
          <a
            key={r.label}
            href={r.href}
            target="_blank"
            rel="noreferrer"
            className="group flex min-h-16 items-center gap-4 border-t border-hair px-5 first:border-t-0 hover:bg-[#fafbfb]"
          >
            <span className="grid size-9 flex-none place-items-center rounded-lg bg-canvas text-[11px] font-bold text-subtle">
              PDF
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base leading-[22px] font-semibold">{r.label}</span>
              <span className="truncate text-sm leading-5 text-subtle">{r.note}</span>
            </span>
            <span className="text-sm text-subtle group-hover:text-ink">Open</span>
          </a>
        ))}
      </div>
    </section>
  );
}
