import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {without?: string[]}: back to seed data. `without` leaves those policies out, so the demo can start
// with no auto policy and add it by dropping the declarations page (same id, so stance and targets reattach).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { without?: string[] };
  await store.reset();
  for (const id of body.without ?? []) await store.removePolicy(id);
  return Response.json({ ok: true, without: body.without ?? [] });
}
