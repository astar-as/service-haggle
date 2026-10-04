import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [calls, person] = await Promise.all([store.calls(), store.person()]);
  return Response.json({ calls, person: { name: person.name, firstName: person.firstName } });
}
