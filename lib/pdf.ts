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
lines.push(m[1].replace(/\\([0-7]{3})/g, (_x, o: string) => String.fromCharCode(parseInt(o, 8))).replace(/\\([\\()])/g, "$1"));
  return lines.join("\n");
}

// ---- Drawn one-page documents (Letter, top-left coordinates) ----------------------------------
// Enough layout for a realistic declarations page: text with width-aware alignment, filled and
// stroked rectangles, rules. Helvetica / Helvetica-Bold with WinAnsi encoding.

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as RGB;

// Helvetica advance widths (1/1000 em) for ASCII 32..126.
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];

const WIN: Record<string, string> = { "•": "\\225", "–": "\\226", "—": "\\227", "’": "\\222", "“": "\\223", "”": "\\224", "·": "\\267", "§": "\\247", "©": "\\251" };
const esc = (s: string) =>
  [...s].map((c) => (WIN[c] ? WIN[c] : c === "\\" || c === "(" || c === ")" ? `\\${c}` : c.charCodeAt(0) >= 32 && c.charCodeAt(0) < 127 ? c : "")).join("");

export function textWidth(s: string, size: number, bold = false) {
  let w = 0;
  for (const c of s) {
    const code = c.charCodeAt(0);
    w += code >= 32 && code < 127 ? HELV[code - 32] : 556;
  }
  return (w * size * (bold ? 1.04 : 1)) / 1000;
}

export class PdfPage {
  private ops: string[] = [];
  readonly width = 612;
  readonly height = 792;

  text(x: number, y: number, s: string, o: { size?: number; bold?: boolean; color?: string; align?: "left" | "right" | "center" } = {}) {
    const size = o.size ?? 9.5;
    const w = textWidth(s, size, o.bold);
    const left = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    const [r, g, b] = hex(o.color ?? "#1b1e24");
    this.ops.push(`BT /${o.bold ? "F2" : "F1"} ${size} Tf ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${left.toFixed(2)} ${(this.height - y).toFixed(2)} Td (${esc(s)}) Tj ET`);
    return w;
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; stroke?: string; width?: number } = {}) {
    const parts: string[] = [];
    if (o.fill) parts.push(`${hex(o.fill).map((v) => v.toFixed(3)).join(" ")} rg`);
    if (o.stroke) parts.push(`${hex(o.stroke).map((v) => v.toFixed(3)).join(" ")} RG ${o.width ?? 0.6} w`);
    parts.push(`${x.toFixed(2)} ${(this.height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${o.fill && o.stroke ? "B" : o.fill ? "f" : "S"}`);
    this.ops.push(parts.join(" "));
  }

  line(x1: number, y: number, x2: number, o: { color?: string; width?: number } = {}) {
    const [r, g, b] = hex(o.color ?? "#d9dde3");
    this.ops.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${o.width ?? 0.6} w ${x1} ${(this.height - y).toFixed(2)} m ${x2} ${(this.height - y).toFixed(2)} l S`);
  }

  build(): Buffer {
    const body = this.ops.join("\n");
    const font = (name: string) => `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`;
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>`,
      `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
      font("Helvetica"),
      font("Helvetica-Bold"),
    ];
    let out = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((o, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${o}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}
