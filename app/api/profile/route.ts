import { applyValues, type Values } from "@/lib/profile";
import { store } from "@/lib/store";
import { invalidateBrief } from "@/lib/strategist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST { values }: write edited profile values back onto Maya's facts, so the agent uses them.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { values?: Values };
  if (!body.values) return Response.json({ error: "values required" }, { status: 400 });
  const [person, policies] = await Promise.all([store.person(), store.policies()]);
  const changed = applyValues(person, policies, body.values);
  if (changed.person) await store.putPerson(changed.person);
  for (const p of changed.policies) await store.putPolicy(p);
  invalidateBrief();
  return Response.json({ person: !!changed.person, policies: changed.policies.map((p) => p.id) });
}
