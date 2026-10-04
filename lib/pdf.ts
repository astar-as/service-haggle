// Minimal one-page PDF writer and reader for the contract and receipt attachments.
// Uncompressed text streams in Helvetica, so the reader can pull the lines back out.

const escape = (s: string) =>
  s
    .replace(
      /[^\x20-\x7e]/g,
      (c) => ({ "—": "-", "–": "-", "·": "-", "’": "'", "“": '"', "”": '"', "✓": "OK" })[c] ?? "",
    )
    .replace(/[\\()]/g, (c) => `\\${c}`);

export function makePdf(title: string, lines: string[]): Buffer {
  const body = [
    "BT",
    "/F2 16 Tf 56 780 Td 20 TL",
    `(${escape(title)}) Tj T*`,
    "/F1 10.5 Tf 15 TL T*",
    ...lines.map((l) => `(${escape(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// Reads back the text lines of a PDF written by makePdf (or any uncompressed Tj stream).
export function pdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const lines: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g))
    lines.push(m[1].replace(/\\([\\()])/g, "$1"));
  return lines.join("\n");
}
