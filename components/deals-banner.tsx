import Link from "next/link";
import { store } from "@/lib/store";
import { usd } from "@/lib/view";
import { Chevron } from "./icons";

// Dashboard nudge when a deal is waiting on Maya, or the latest signed deal otherwise.
export async function DealsBanner() {
  const deals = (await store.deals()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const waiting = deals.find(
    (d) => d.status === "awaiting_release" || d.status === "awaiting_signature",
  );
  const signed = deals.find((d) => d.status === "bound");
  const deal = waiting ?? signed;
  if (!deal) return null;
  const text = waiting
    ? waiting.status === "awaiting_release"
      ? `${waiting.insurer} needs your OK to receive ${waiting.requested.length} sealed details`
      : `Sign ${waiting.insurer} at ${usd(waiting.monthly)}/mo · contract checked`
    : `Signed ${deal.insurer} at ${usd(deal.monthly)}/mo · receipt ${deal.receipt?.id ?? ""}`;
  return (
    <Link
      href={`/deal/${deal.id}`}
      className={`flex min-h-14 items-center gap-3 rounded-2xl px-5 transition-transform duration-150 ease-out-strong active:scale-[0.99] ${waiting ? "bg-accent text-white" : "bg-white text-ink shadow-[0_0_0_1px_var(--color-line)]"}`}
    >
      {waiting && <span className="live size-2 rounded-full bg-white" />}
      <span className="flex-1 text-base font-medium">{text}</span>
      <Chevron />
    </Link>
  );
}
