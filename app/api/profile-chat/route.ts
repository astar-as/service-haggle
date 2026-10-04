import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";
import { hasModel } from "@/lib/models";
import { mastra } from "@/mastra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!hasModel()) {
    return Response.json(
      {
        error:
          "No model configured. Set NEON_AI_GATEWAY_URL + NEON_AI_GATEWAY_KEY or OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }
  const { messages, trigger } = await req.json();
  const stream = await handleChatStream({
    mastra,
    agentId: "profiler",
    version: "v7",
    sendReasoning: true,
    params: { messages, trigger },
  });
  return createUIMessageStreamResponse({ stream });
}
