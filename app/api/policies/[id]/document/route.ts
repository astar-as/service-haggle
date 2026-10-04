import { policyDocument } from "@/lib/policy-doc";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The policy's current declarations page: the issued policy from the latest signed deal if there
// is one, otherwise generated from the policy as it stands.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [policy, person, deals] = await Promise.all([
    store.policy(id),
    store.person(),
    store.deals(),
  ]);
  if (!policy) return new Response("Not found", { status: 404 });
  const bound = deals
    .filter((d) => d.policyId === id && d.status === "bound" && d.policyPdf)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const previous =
    Number(
      policy.facts.find((f) => f.label === "Previous premium")?.value.replace(/[^0-9.]/g, ""),
    ) || undefined;
  const pdf = bound
    ? Buffer.from(bound.policyPdf!, "base64")
    : policyDocument({
        variant: "declarations",
        policy,
        person,
        previousMonthly: previous,
        issued: "2026-09-20",
      });
  const filename =
    bound?.policyFilename ??
    `${policy.insurer.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-declarations.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
    },
  });
}
