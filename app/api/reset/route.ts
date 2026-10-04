import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await store.reset();
  return Response.json({ ok: true });
}
