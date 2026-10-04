import { store } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET ?doc=contract|receipt: the PDF exactly as it went over email.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const deal = await store.deal((await params).id);
  const doc = new URL(req.url).searchParams.get("doc") === "contract" ? "contract" : "receipt";
  const b64 = doc === "contract" ? deal?.contractPdf : deal?.receiptPdf;
  const filename = doc === "contract" ? deal?.contract?.filename : deal?.receipt?.filename;
  if (!deal || !b64) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename ?? `${doc}.pdf`}"`,
    },
  });
}
