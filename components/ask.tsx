"use client";

import { AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { ArrowUp } from "./icons";

export function Ask({ placeholder, policyId }: { placeholder: string; policyId?: string }) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({ api: "/api/chat", body: policyId ? { policyId } : undefined }),
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
              <MessagePrimitive.Root className="rise max-w-[88%] self-start rounded-[18px_18px_18px_6px] bg-white px-4 py-3 text-base leading-6 text-ink-2 shadow-[inset_0_0_0_1px_var(--color-line)]">
                <MessagePrimitive.Parts />
              </MessagePrimitive.Root>
            )
          }
        </ThreadPrimitive.Messages>
        <ComposerPrimitive.Root className="flex items-center gap-2 rounded-2xl bg-white py-1.5 pr-1.5 pl-[18px] shadow-[0_0_0_1px_var(--color-line)] focus-within:shadow-[0_0_0_1.5px_var(--color-accent)]">
          <ComposerPrimitive.Input
            aria-label={placeholder}
            placeholder={placeholder}
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
