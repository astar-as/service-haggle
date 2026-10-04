"use client";

import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  type ToolCallMessagePartProps,
} from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FactChange } from "@/lib/profile";
import { kindLabel, usd } from "@/lib/view";
import { ArrowUp } from "./icons";

interface Proposal {
  summary: string;
  changes: (FactChange & { before?: string })[];
  effects: {
    policyId: string;
    insurer: string;
    kind: string;
    from: number;
    to: number;
    reasons: { label: string; pct: number }[];
  }[];
  totalDelta: number;
}

// Chat that keeps the profile up to date. The agent asks clarifying questions, then proposes
// changes as a card; nothing is saved until Maya presses Apply.
export function ProfileChat() {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/profile-chat" }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex flex-col gap-3">
        <ThreadPrimitive.Messages>
          {({ message }) =>
            message.role === "user" ? (
              <MessagePrimitive.Root className="rise max-w-[80%] self-end rounded-[18px_18px_6px_18px] bg-accent-soft px-4 py-3 text-base leading-6 text-ink-2">
                <MessagePrimitive.Parts />
              </MessagePrimitive.Root>
            ) : (
              <MessagePrimitive.Root className="rise flex max-w-[92%] flex-col gap-2 self-start rounded-[18px_18px_18px_6px] bg-white px-4 py-3 text-base leading-6 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <MessagePrimitive.Parts
                  components={{
                    tools: { by_name: { profilePropose: ProposalCard }, Fallback: ToolChip },
                  }}
                />
              </MessagePrimitive.Root>
            )
          }
        </ThreadPrimitive.Messages>
        <ComposerPrimitive.Root className="flex items-center gap-2 rounded-2xl bg-white py-1.5 pr-1.5 pl-[18px] shadow-[0_0_0_1px_var(--color-line)] focus-within:shadow-[0_0_0_1.5px_var(--color-accent)]">
          <ComposerPrimitive.Input
            aria-label="Tell me what changed"
            placeholder="Tell me what changed… e.g. “I started working from home”"
            rows={1}
            className="h-11 min-w-0 flex-1 resize-none bg-transparent py-[11px] text-[15px] leading-[22px] text-ink outline-none placeholder:text-subtle"
          />
          <ComposerPrimitive.Send
            aria-label="Send"
            className="grid size-11 flex-none place-items-center rounded-[11px] bg-ink text-white transition-transform duration-150 ease-out-strong active:scale-95 disabled:opacity-40"
          >
            <ArrowUp />
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

function ToolChip({ toolName, status }: ToolCallMessagePartProps) {
  if (toolName !== "profileRead") return null;
  return (
    <span className="text-[13px] text-subtle">
      {status.type === "running" ? "Reading your profile…" : "Read your profile"}
    </span>
  );
}

const DISCLOSURE = {
  shareable: "shareable",
  private: "private · never said",
  hidden: "sealed",
} as const;

function ProposalCard({ result, status }: ToolCallMessagePartProps<unknown, Proposal>) {
  const router = useRouter();
  const [state, setState] = useState<"open" | "saving" | "applied" | "discarded">("open");
  if (!result)
    return (
      <span className="text-[13px] text-subtle">
        {status.type === "running" ? "Working out the change…" : ""}
      </span>
    );

  async function apply() {
    setState("saving");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes: result!.changes }),
    });
    setState(res.ok ? "applied" : "open");
    if (res.ok) router.refresh();
  }

  return (
    <div className="-mx-1 flex flex-col overflow-hidden rounded-[14px] bg-canvas shadow-[inset_0_0_0_1px_var(--color-line)]">
      <p className="px-4 pt-3 pb-2 text-[15px] leading-[22px] font-semibold text-ink">
        {result.summary}
      </p>
      {result.changes.map((c, i) => (
        <div
          key={i}
          className="flex flex-col gap-0.5 border-t border-hair px-4 py-2.5 text-[14px] leading-5"
        >
          <span className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-subtle">
              {c.action === "add" ? "Add" : c.action === "remove" ? "Remove" : "Change"} · {c.label}
            </span>
            {c.disclosure && (
              <span className="text-[12px] text-faint">{DISCLOSURE[c.disclosure]}</span>
            )}
          </span>
          <span className="num font-semibold text-ink">
            {c.before && c.action !== "add" && (
              <span className="font-normal text-subtle line-through decoration-faint">
                {c.before}
              </span>
            )}{" "}
            {c.action === "remove" ? "" : c.value}
          </span>
        </div>
      ))}
      {result.effects.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-hair px-4 py-2.5 text-[14px] leading-5">
          {result.effects.map((e) => (
            <span key={e.policyId} className="flex items-baseline justify-between gap-3">
              <span>
                {kindLabel(e.kind)} <span className="text-subtle">· {e.insurer}</span>
              </span>
              <span className="num">
                <span className="text-subtle">{usd(e.from)}</span> →{" "}
                <span className={`font-semibold ${e.to < e.from ? "text-money" : "text-accent"}`}>
                  {usd(e.to)}
                </span>
              </span>
            </span>
          ))}
          <span className="text-[12px] text-faint">
            Estimated at your next renewal, not a quote.
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-hair px-3 py-2.5">
        {state === "applied" ? (
          <span className="px-1 text-[14px] font-semibold text-money">Saved to your profile.</span>
        ) : state === "discarded" ? (
          <span className="px-1 text-[14px] text-subtle">Discarded.</span>
        ) : (
          <>
            <button
              onClick={apply}
              disabled={state === "saving"}
              className="min-h-10 rounded-lg bg-accent px-4 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {state === "saving" ? "Saving…" : "Apply"}
            </button>
            <button
              onClick={() => setState("discarded")}
              className="min-h-10 rounded-lg px-3 text-[14px] font-medium text-muted hover:text-ink"
            >
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
