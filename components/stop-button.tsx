"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StopButton({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const stop = async () => {
    setBusy(true);
    await fetch("/api/calls/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={stop}
      disabled={busy}
      className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-[#b42318] shadow-[inset_0_0_0_1px_var(--color-line)] hover:bg-white disabled:opacity-50"
    >
      {busy ? "Stopping…" : "Stop"}
    </button>
  );
}
