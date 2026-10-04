"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone } from "./icons";

export function ShopButton({ policyId, insurer }: { policyId: string; insurer: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/agents/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policyId }),
    });
    const json = (await res.json().catch(() => ({}))) as { calls?: { id: string }[]; error?: string };
    setBusy(false);
    if (!res.ok || !json.calls?.length) return setError(json.error ?? "Couldn't start the agents.");
    router.push(`/call/${json.calls[0].id}`);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="flex min-h-14 items-center justify-center gap-2.5 rounded-2xl bg-ink px-5 text-base font-semibold text-white transition-transform duration-150 ease-out-strong active:scale-[0.99] disabled:opacity-60"
      >
        <Phone size={17} />
        {busy ? "Starting agents…" : `Negotiate with ${insurer} and competitors`}
      </button>
      {error && <span className="px-1 text-sm text-[#b42318]">{error}</span>}
    </div>
  );
}
