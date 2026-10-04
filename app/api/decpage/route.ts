import { keepAlive } from "@/lib/background";
import { parseDecPage, type DecPageInput } from "@/lib/decpage";
import { ModelUnavailableError } from "@/lib/models";
import { checkPolicy } from "@/lib/monitor";
import { store } from "@/lib/store";
import { invalidateBrief } from "@/lib/strategist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_BYTES = 8 * 1024 * 1024;

// POST multipart {file: PDF | .txt | .eml} or JSON {text}: read a declarations page into a policy + facts + coverage.
export async function POST(req: Request) {
  let input: DecPageInput;
  try {
    input = await readInput(req);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
  try {
    const result = await parseDecPage(input);
    const { policy } = result;
    invalidateBrief(policy.id);
    await store.addSignal({
      id: `sig-decpage-${policy.id}-${Date.now()}`,
      personId: policy.personId,
      policyId: policy.id,
      at: new Date().toISOString().slice(0, 10),
      source: "email",
      title: `Read your ${policy.insurer} declarations page: ${policy.coverage?.summary ?? policy.product}.`,
      ...(result.previousPremium !== undefined && result.previousPremium !== policy.monthlyPremium
        ? { impactMonthly: Math.round(policy.monthlyPremium - result.previousPremium) }
        : {}),
    });
    keepAlive(checkPolicy(policy.id).catch((e) => console.error("[decpage] check failed:", e)));
    return Response.json(result);
  } catch (e) {
    console.error("[decpage]", e);
    const status = e instanceof ModelUnavailableError ? 503 : 422;
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}

async function readInput(req: Request): Promise<DecPageInput> {
  if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const body = (await req.json().catch(() => ({}))) as { text?: string };
    if (!body.text?.trim()) throw new Error("Send a file or {text}");
    return { text: body.text };
  }
  const form = await req.formData();
  const file = form.get("file");
  const text = form.get("text");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) throw new Error("File is larger than 8 MB");
    const data = new Uint8Array(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    return isPdf
      ? { pdf: { data, filename: file.name } }
      : { text: new TextDecoder().decode(data) };
  }
  if (typeof text === "string" && text.trim()) return { text };
  throw new Error("Send a file or text");
}
