"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Deal } from "@/lib/types";
import { usd } from "@/lib/view";

// Starts closing an agreed price over email, or links to the deal already in progress.
export function CloseDeal({
  callId,
  monthly,
  insurer,
}: {
  callId: string;
  monthly: number;
  insurer: string;
}) {
  const router = useRouter();
  const [existing, setExisting] = useState<Deal>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [autopilot, setAutopilot] = useState(false);

  useEffect(() => {
    fetch("/api/deals")
      .then((r) => r.json())
      .then((d: { deals?: Deal[] }) =>
        setExisting(
          d.deals?.find(
            (x) => x.callId === callId && x.status !== "failed" && x.status !== "declined",
          ),
        ),
      )
      .catch(() => {});
  }, [callId]);

  const cls =
    "flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-base font-semibold text-white transition-transform duration-150 ease-out-strong active:scale-[0.99] disabled:opacity-60";

  if (existing)
    return (
      <Link href={`/deal/${existing.id}`} className={cls}>
        {existing.status === "bound" ? "View signed deal" : "Continue closing the deal"}
      </Link>
    );

  return (
    <div className="flex flex-col gap-2">
      <button
        className={cls}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          const res = await fetch("/api/deals", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ callId, autopilot }),
          });
          const body = (await res.json()) as { deal?: Deal; error?: string };
          if (body.deal) router.push(`/deal/${body.deal.id}`);
          else {
            setError(body.error ?? "Couldn't start the deal");
            setBusy(false);
          }
        }}
      >
        {busy ? "Emailing the policy desk…" : `Close the deal at ${usd(monthly)} by email`}
      </button>
      <label className="flex items-start gap-2.5 px-1 text-sm leading-5 text-ink-2">
        <input
          type="checkbox"
          checked={autopilot}
          onChange={(e) => setAutopilot(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-semibold">Autopilot</span> · release my details and sign for me if
          every term in the contract matches the deal. Anything off and I stop and ask.
        </span>
      </label>
      <p className="px-1 text-[13px] leading-[18px] text-subtle">
        {error ??
          (autopilot
            ? `I'll close it with ${insurer} end to end over AgentMail and send you the signed receipt.`
            : `I'll get ${insurer} to confirm in writing over AgentMail, ask before sharing any sealed details, check the contract, and you sign.`)}
      </p>
    </div>
  );
}
