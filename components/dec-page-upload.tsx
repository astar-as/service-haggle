"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function DecPageUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/decpage", { method: "POST", body: form });
      const json = (await res.json().catch(() => ({}))) as {
        policy?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.policy) return setError(json.error ?? `Failed (${res.status})`);
      router.push(`/policy/${json.policy.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void send(file);
        }}
        disabled={busy}
        className={`flex min-h-14 items-center justify-center rounded-2xl border border-dashed px-5 text-[15px] font-medium transition-colors duration-150 disabled:opacity-60 ${
          over
            ? "border-accent bg-accent-soft text-accent"
            : "border-line text-subtle hover:text-ink"
        }`}
      >
        {busy
          ? "Reading your declarations page…"
          : "Drop a declarations page to add or update a policy"}
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf,.txt,.eml,text/plain,message/rfc822"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void send(file);
        }}
      />
      {error && <span className="px-1 text-sm text-[#b42318]">{error}</span>}
    </div>
  );
}
