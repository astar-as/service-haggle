import { COVERAGE } from "./coverage";
import { PdfPage, textWidth } from "./pdf";
import type { Person, Policy } from "./types";

// A realistic one-page insurance document in the style of data/demo/northstar-dec-page.html:
//   declarations  the policy as it stands (portfolio)
//   contract      the insurer's offer to sign, with a "summary of agreed terms" the agent checks
//   bound         the issued policy after signing, with the new policy number
// All insurers and details are fictional.

export interface PolicyDocInput {
  variant: "declarations" | "contract" | "bound";
  policy: Policy;
  person: Person;
  insurer?: string;
  monthly?: number;
  previousMonthly?: number;
  policyNumber?: string;
  version?: number;
  deductible?: string;
  dealRef?: string;
  issued?: string;
  sealed?: { dob?: string; licence?: string; vin?: string; address?: string };
}

const NAVY = "#14365f";
const GRAY = "#6b7280";
const INK = "#1b1e24";
const RULE = "#d9dde3";
const L = 44;
const R = 568;

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const us = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y}`;
};
const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};
const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

// Share of the term premium per auto coverage, from the Northstar renewal declarations.
const AUTO_WEIGHTS: [RegExp, number][] = [
  [/bodily/i, 412],
  [/property/i, 268],
  [/uninsured/i, 96],
  [/collision/i, 388],
  [/comprehensive/i, 142],
  [/medical/i, 48],
  [/rental/i, 38],
  [/roadside/i, 16],
];
const FEE_WEIGHT = 80;

export function policyNumberFor(policy: Policy, insurer = policy.insurer) {
  const onFile = policy.facts.find((f) => f.label === "Policy number")?.value;
  if (onFile && insurer === policy.insurer) return onFile;
  const prefix = insurer
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .padEnd(3, "X")
    .slice(0, 3);
  let h = 0;
  for (const c of `${policy.id}${insurer}`) h = (h * 31 + c.charCodeAt(0)) % 99991;
  return `${prefix}-CA-${String(20000 + (h % 79999)).padStart(5, "0")}-${String(1000 + (h % 8999))}`;
}

export function policyDocument(i: PolicyDocInput): Buffer {
  const { policy, person, variant } = i;
  const insurer = i.insurer ?? policy.insurer;
  const monthly = i.monthly ?? policy.monthlyPremium;
  const auto = policy.kind === "auto";
  const termMonths = auto ? 6 : 12;
  const termPremium = monthly * termMonths;
  const issued = i.issued ?? new Date().toISOString().slice(0, 10);
  const start = policy.renewsOn;
  const end = addMonths(start, termMonths);
  const fact = (owner: { facts: Person["facts"] }, label: string) =>
    owner.facts.find((f) => f.label === label)?.value;
  const sealed = {
    dob: i.sealed?.dob ?? fact(person, "Date of birth"),
    licence: i.sealed?.licence ?? fact(person, "Driver's licence"),
    vin: i.sealed?.vin ?? fact(policy, "VIN"),
    address: i.sealed?.address ?? fact(person, "Home address"),
  };
  const number = i.policyNumber ?? policyNumberFor(policy, insurer);
  const coverage = policy.coverage ?? COVERAGE[policy.id];
  const p = new PdfPage();
  let y = 40;

  // Header
  p.rect(L, y, 30, 30, { fill: NAVY });
  p.text(L + 15, y + 20, insurer[0], { size: 15, bold: true, color: "#ffffff", align: "center" });
  p.text(L + 40, y + 13, insurer, { size: 15, bold: true, color: NAVY });
  p.text(L + 40, y + 26, "Insurance Company · San Francisco, CA", { size: 7.5, color: GRAY });
  const title = auto ? "Personal Auto Policy" : `${policy.product.split(" · ")[0]} Policy`;
  p.text(R, y + 11, title, { size: 11.5, bold: true, color: NAVY, align: "right" });
  const sub =
    variant === "contract"
      ? `Policy Contract · Version ${i.version ?? 1} · Issued ${longDate(issued)}`
      : variant === "bound"
        ? `Policy Declarations · Bound ${longDate(issued)}`
        : `${auto ? "Renewal " : ""}Declarations · Issued ${longDate(issued)}`;
  p.text(R, y + 25, sub, { size: 7.5, color: GRAY, align: "right" });
  y += 42;
  p.line(L, y, R, { color: NAVY, width: 1.6 });
  y += 20;

  const section = (label: string) => {
    p.text(L, y, label.toUpperCase(), { size: 8, bold: true, color: NAVY });
    y += 8;
  };
  // Label left, value right; a value too wide for its column wraps at a comma onto a second line.
  const pair = (x1: number, x2: number, label: string, value: string) => {
    p.text(x1, y, label, { size: 8.5, color: GRAY });
    const room = x2 - x1 - textWidth(label, 8.5) - 10;
    if (textWidth(value, 8.5) <= room || !value.includes(",")) {
      p.text(x2, y, value, { size: 8.5, color: INK, align: "right" });
      return 0;
    }
    const cut = value.lastIndexOf(",", Math.floor(value.length * 0.6));
    p.text(x2, y, value.slice(0, cut + 1), { size: 8.5, color: INK, align: "right" });
    p.text(x2, y + 11, value.slice(cut + 1).trim(), { size: 8.5, color: INK, align: "right" });
    return 11;
  };

  // Policy information
  section("Policy information");
  y += 10;
  const mid = 306;
  const info: [string, string, string, string][] = [
    ["Named insured", person.name, "Policy number", number],
    [
      "Mailing address",
      sealed.address ?? `${person.city}, ${person.state}`,
      "Customer since",
      insurer === policy.insurer ? String(policy.memberSince) : String(issued.slice(0, 4)),
    ],
    [
      variant === "declarations" ? "Current term" : "Policy term",
      `${us(start)} – ${us(end)}`,
      "Term length",
      `${termMonths} months, 12:01 a.m. standard time`,
    ],
  ];
  for (const [a, b, c, d] of info) {
    const extra = Math.max(pair(L, mid - 14, a, b), pair(mid + 8, R, c, d));
    y += 16 + extra;
  }
  y += 6;

  const table = (
    cols: { label: string; x: number; align?: "right" }[],
    rows: string[][],
    opts: { muted?: number[] } = {},
  ) => {
    p.line(L, y - 2, R, { color: RULE });
    y += 10;
    for (const c of cols)
      p.text(c.align === "right" ? c.x : c.x, y, c.label, {
        size: 7.5,
        bold: true,
        color: GRAY,
        align: c.align === "right" ? "right" : "left",
      });
    y += 6;
    p.line(L, y, R, { color: RULE });
    y += 12;
    rows.forEach((r, ri) => {
      r.forEach((cell, ci) =>
        p.text(cols[ci].x, y, cell, {
          size: 8.5,
          color: opts.muted?.includes(ri) ? GRAY : INK,
          align: cols[ci].align,
        }),
      );
      y += 5;
      p.line(L, y, R, { color: "#eceef1" });
      y += 12;
    });
    y += 4;
  };

  if (auto) {
    section("Drivers");
    y += 4;
    table(
      [
        { label: "Driver", x: L + 4 },
        { label: "Date of birth", x: 150 },
        { label: "License", x: 238 },
        { label: "Licensed since", x: 330 },
        { label: "Violations", x: 420 },
        { label: "At-fault accidents", x: 490 },
      ],
      [
        [
          person.name,
          sealed.dob ? us(sealed.dob) : "On file",
          sealed.licence ? `CA ${sealed.licence}` : "On file",
          "2014",
          "None",
          "None",
        ],
      ],
    );
    section("Vehicle");
    y += 4;
    const vehicle = fact(policy, "Vehicle") ?? policy.product.split(" · ")[1] ?? "Vehicle";
    const mileage = fact(policy, "Annual mileage on file") ?? "12,000";
    table(
      [
        { label: "Vehicle", x: L + 4 },
        { label: "VIN", x: 220 },
        { label: "Garaging ZIP", x: 370 },
        { label: "Use", x: 445 },
        { label: "Annual mileage", x: R - 4, align: "right" },
      ],
      [
        [
          `${vehicle} 4D`,
          sealed.vin ?? "On file",
          (sealed.address?.match(/\b\d{5}\b/) ?? ["94158"])[0],
          "Commute",
          mileage.replace(/[^0-9,]/g, ""),
        ],
      ],
    );
  }

  // Coverages
  section(auto ? "Coverages, limits and premium" : "Coverage");
  y += 4;
  const items =
    coverage?.items ??
    policy.facts
      .filter((f) => f.disclosure === "shareable")
      .map((f) => ({ label: f.label, value: f.value, deductible: undefined, mustKeep: false }));
  const weights = items.map((it) =>
    auto ? (AUTO_WEIGHTS.find(([re]) => re.test(it.label))?.[1] ?? 20) : 1,
  );
  const totalW = weights.reduce((a, b) => a + b, 0) + (auto ? FEE_WEIGHT : 0);
  const scale = termPremium / totalW;
  const shares = weights.map((w) => Math.round(w * scale * 100) / 100);
  const fee = Math.round((termPremium - shares.reduce((a, b) => a + b, 0)) * 100) / 100;
  const deductibleFor = (it: { label: string; deductible?: string }) =>
    it.deductible
      ? /collision/i.test(it.label) && i.deductible
        ? i.deductible
        : it.deductible
      : "—";
  table(
    [
      { label: "Coverage", x: L + 4 },
      { label: "Limits", x: 200 },
      { label: "Deductible", x: 440 },
      { label: `${termMonths}-month premium`, x: R - 4, align: "right" },
    ],
    [
      ...items.map((it, k) => [
        it.label,
        it.value.length > 44 ? `${it.value.slice(0, 42)}…` : it.value,
        deductibleFor(it),
        auto ? money(shares[k]) : k === 0 ? money(termPremium) : "Included",
      ]),
      ...(auto ? [["Policy fee", "", "", money(fee)]] : []),
    ],
    { muted: auto ? [items.length] : [] },
  );

  // Premium box
  const bx = 330;
  const discounts = auto ? "Good driver · Paperless · Multi-year loyalty" : "Paperless · Autopay";
  const rows: [string, string, string?][] = [["Discounts", discounts]];
  if (i.previousMonthly && i.previousMonthly !== monthly) {
    rows.push(["Previous term premium", money(i.previousMonthly * termMonths)]);
    const pct = ((monthly - i.previousMonthly) / i.previousMonthly) * 100;
    rows.push([
      "Change from previous term",
      `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
      pct > 0 ? "#b42318" : "#1f7a4a",
    ]);
  }
  for (const [a, b, color] of rows) {
    p.text(bx + 4, y, a, { size: 8.5, color: GRAY });
    p.text(R - 4, y, b, { size: 8.5, color: color ?? INK, bold: !!color, align: "right" });
    y += 16;
  }
  p.rect(bx, y - 11, R - bx, 20, { fill: NAVY });
  p.text(
    bx + 6,
    y + 2.5,
    `${variant === "declarations" && auto ? "Renewal term" : "Term"} premium (${termMonths} months)`,
    { size: 9, bold: true, color: "#ffffff" },
  );
  p.text(R - 6, y + 2.5, money(termPremium), {
    size: 9.5,
    bold: true,
    color: "#ffffff",
    align: "right",
  });
  y += 24;
  p.text(bx + 4, y, "Payment plan", { size: 8.5, color: GRAY });
  p.text(R - 4, y, `EFT monthly · ${money(monthly)} per month`, { size: 8.5, align: "right" });
  y += 22;

  // Contract: the terms the agent checks, plus signature lines
  if (variant === "contract") {
    section(`Summary of agreed terms${i.dealRef ? ` · deal ${i.dealRef}` : ""}`);
    y += 8;
    const liability = fact(policy, "Liability limits") ?? "";
    const terms = [
      `Named insured: ${person.name}`,
      `Monthly premium: ${money(monthly)}`,
      ...(liability ? [`Liability limits: ${liability}`] : []),
      ...(auto
        ? [`Collision deductible: ${i.deductible ?? fact(policy, "Deductible") ?? "$500"}`]
        : []),
      `Effective: ${us(start)} for ${termMonths} months`,
    ];
    for (const t of terms) {
      p.text(L, y, t, { size: 8.5 });
      y += 13;
    }
    y += 16;
    p.line(L, y, L + 230, { color: INK, width: 0.7 });
    p.line(L + 280, y, L + 400, { color: INK, width: 0.7 });
    y += 10;
    p.text(L, y, "Signature of named insured", { size: 7.5, color: GRAY });
    p.text(L + 280, y, "Date", { size: 7.5, color: GRAY });
    y += 16;
  }

  // Footer
  const footY = 748;
  p.line(L, footY - 12, R, { color: RULE });
  const foot =
    variant === "contract"
      ? `Coverage begins once the signed contract is on file. Form ${insurer.slice(0, 2).toUpperCase()}-CON-CA 10/26.`
      : variant === "bound"
        ? `This policy is in force for the term above. Form ${insurer.slice(0, 2).toUpperCase()}-DEC-CA 10/26.`
        : `Your policy renews automatically on ${longDate(start)} unless you tell us otherwise.`;
  p.text(L, footY, foot, { size: 7, color: GRAY });
  p.text(
    L,
    footY + 11,
    `Specimen document created for the Lowball demo. ${insurer} and all policy details are fictional.`,
    { size: 7, color: GRAY },
  );
  return p.build();
}
