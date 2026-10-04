import Link from "next/link";
import { Back, Chevron } from "@/components/icons";
import { store } from "@/lib/store";
import type { Deal } from "@/lib/types";
import { kindLabel, shortDate, usd } from "@/lib/view";

export const dynamic = "force-dynamic";

const STATUS: Record<Deal["status"], { label: string; tone: string }> = {
  confirming: { label: "Confirming", tone: "bg-canvas text-subtle" },
  awaiting_release: { label: "Needs your OK", tone: "bg-accent-soft text-accent" },
  releasing: { label: "Sending details", tone: "bg-canvas text-subtle" },
  checking_contract: { label: "Checking contract", tone: "bg-canvas text-subtle" },
  awaiting_signature: { label: "Needs your signature", tone: "bg-accent-soft text-accent" },
  signing: { label: "Signing", tone: "bg-canvas text-subtle" },
  bound: { label: "Signed", tone: "bg-[#e7f4ec] text-money" },
  declined: { label: "Declined", tone: "bg-canvas text-faint" },
  failed: { label: "Stopped", tone: "bg-canvas text-faint" },
};

export default async function DealsPage() {
  const [deals, policies] = await Promise.all([store.deals(), store.policies()]);
  const sorted = deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const signed = sorted.filter((d) => d.status === "bound");
  const savedYear = signed.reduce((a, d) => a + (d.previousMonthly - d.monthly) * 12, 0);

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-9 px-5 pt-7 pb-14">
      <Link
        href="/"
        className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium text-muted hover:text-ink"
      >
        <Back />
        All policies
      </Link>
      <section className="flex flex-col gap-2">
        <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
          Deals and receipts
        </h1>
        <p className="text-[17px] leading-[26px] text-ink-2">
          Every deal I've closed over email with AgentMail, with the contract I checked and the receipt you signed.
          {signed.length > 0 && (
            <>
              {" "}
              <span className="num font-semibold text-money">{usd(savedYear)}</span> a year saved so
              far.
            </>
          )}
        </p>
      </section>

      {sorted.length === 0 ? (
        <p className="rounded-[18px] bg-white px-5 py-5 text-base text-subtle shadow-[0_0_0_1px_var(--color-line)]">
          No deals yet. When a negotiation agrees a price, "Close the deal" starts one here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
          {sorted.map((d) => {
            const policy = policies.find((p) => p.id === d.policyId);
            const s = STATUS[d.status];
            return (
              <div
                key={d.id}
                className="flex flex-col gap-2 border-t border-hair px-5 py-4 first:border-t-0"
              >
                <Link href={`/deal/${d.id}`} className="group flex items-center gap-4">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base leading-[22px] font-semibold">
                      {d.insurer}{" "}
                      <span className="font-normal text-subtle">
                        · {kindLabel(String(policy?.kind ?? ""))}
                      </span>
                    </span>
                    <span className="num text-sm leading-5 text-subtle">
                      {usd(d.previousMonthly)} → {usd(d.monthly)}/mo · {shortDate(d.createdAt)} ·{" "}
                      {d.ref}
                      {d.autopilot ? " · autopilot" : ""}
                    </span>
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${s.tone}`}>
                    {s.label}
                  </span>
                  <Chevron className="text-faint group-hover:text-ink" />
                </Link>
                {(d.receiptPdf || d.contractPdf) && (
                  <span className="flex flex-wrap gap-3 text-[13px]">
                    {d.receiptPdf && (
                      <a
                        href={`/api/deals/${d.id}/pdf?doc=receipt`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent underline-offset-2 hover:underline"
                      >
                        📎 Signed receipt {d.receipt?.id}
                      </a>
                    )}
                    {d.contractPdf && (
                      <a
                        href={`/api/deals/${d.id}/pdf?doc=contract`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-subtle underline-offset-2 hover:text-ink hover:underline"
                      >
                        📎 Contract v{d.contract?.version}
                      </a>
                    )}
                    {d.receipt?.policyNumber && (
                      <span className="text-subtle">Policy {d.receipt.policyNumber}</span>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
