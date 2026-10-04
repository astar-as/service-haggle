import { keepAlive } from "@/lib/background";
import { replay, replayStatus } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  return Response.json(replayStatus());
}

export async function POST(req: Request) {
  if (replayStatus().running) return Response.json({ error: "A replay is already running.", ...replayStatus() }, { status: 409 });
  const body = (await req.json().catch(() => ({}))) as {
    days?: number;
    endDate?: string;
    delayMs?: number;
    useExa?: boolean;
    useModel?: boolean;
  };
  keepAlive(replay(body).catch((e) => console.error("[replay]", e)));
  return Response.json({ started: true, ...replayStatus() }, { status: 202 });
}
