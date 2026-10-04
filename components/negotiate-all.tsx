"use client";

import { useState } from "react";
import { Play } from "./icons";

export function NegotiateAll() {
  const [busy, setBusy] = useState<"replay" | "launch" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "replay" | "launch") => {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(kind === "replay" ? "/api/monitor/replay" : "/api/agents/launch", { method: "POST" });
      if (!res.ok) setError((await res.json().catch(() => null))?.error ?? `Failed (${res.status})`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-1 text-[13px] leading-[18px] text-subtle">
      <button
        type="button"
        onClick={() => run("replay")}
        disabled={busy !== null}
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink disabled:opacity-50"
      >
        <Play />
        {busy === "replay" ? "Replaying…" : "Replay the last 30 days"}
      </button>
      {error && <span className="text-[#b42318]">{error}</span>}
      <button
        type="button"
        onClick={() => run("launch")}
        disabled={busy !== null}
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-accent disabled:opacity-50"
      >
        {busy === "launch" ? "Starting agents…" : "Negotiate everything now"}
      </button>
    </div>
  );
}
