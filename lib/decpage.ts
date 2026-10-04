import { generateText } from "ai";
import { z } from "zod";
import { COVERAGE } from "./coverage";
import { extractJson, getModel } from "./models";
import { PERSON_ID } from "./seed";
import { store } from "./store";
import type { Coverage, Disclosure, Fact, Policy } from "./types";

// A declarations page arrives as a PDF upload, a pasted/forwarded email, or plain text.
export interface DecPageInput {
  text?: string;
  pdf?: { data: Uint8Array; filename?: string };
}

export interface DecPageResult {
  policy: Policy;
  created: boolean;
  previousPremium?: number;
}

const FactOut = z.object({
  label: z.string(),
  value: z.string(),
  disclosure: z.enum(["hidden", "private", "shareable"]),
});

const Out = z.object({
  insurer: z.string().min(1),
  kind: z.string().min(1),
  product: z.string().min(1),
  premium: z.number().positive(),
  premiumTermMonths: z.number().int().positive(),
  renewsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memberSince: z.number().int().nullable().optional(),
  phone: z.string().nullable().optional(),
  facts: z.array(FactOut),
  coverage: z.object({
    summary: z.string(),
    items: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        deductible: z.string().nullable().optional(),
        mustKeep: z.boolean(),
      }),
    ),
  }),
});

const SYSTEM = `You read insurance declarations pages and turn them into structured data for a personal insurance agent.
Extract only what the document says. Never invent numbers, coverages or dates.
- kind: one of auto, health, renters, home, pet, life (lowercase), or another single lowercase word.
- product: short human label, e.g. "Full coverage · 2019 Honda Civic" or "Silver PPO · Covered California".
- premium: the total premium for the term printed on the page (renewal premium if both current and renewal are shown). premiumTermMonths: 6 or 12 for a policy term, 1 if the page states a monthly amount.
- renewsOn: the date the next (renewal) term starts, which is the end of the current term, YYYY-MM-DD. Never the end of the renewal term. If only one period is printed, use its end date.
- memberSince: the year the customer first became a customer, if printed; otherwise null.
- phone: the insurer's customer service phone, if printed; otherwise null.
- facts: underwriting facts an insurer would quote on (vehicle, drivers, mileage, deductibles, limits, claims history, discounts, address city).
  disclosure: "hidden" for identifiers (policy number, VIN, driver's licence, date of birth, full street address, account numbers);
  "private" for anything that weakens a negotiation if said aloud (e.g. the renewal increase, payment history);
  "shareable" for rating facts a competitor needs to quote. The garaging ZIP and city are shareable.
  Put every identifier in its own fact. Never put a VIN, licence number, date of birth or street address inside another fact's value
  (Vehicle: "2019 Honda Civic LX" and VIN: "..." are two facts).
- coverage.items: every coverage line with its limit as value and its deductible if any. mustKeep=true for liability, uninsured motorist,
  collision, comprehensive and other core protections; false for add-ons like roadside, rental, glass.
- coverage.summary: one short line, e.g. "Full coverage, 100/300/100 liability, $500 deductibles".
Output shape: {insurer, kind, product, premium, premiumTermMonths, renewsOn, memberSince, phone, facts:[{label,value,disclosure}], coverage:{summary, items:[{label,value,deductible,mustKeep}]}}`;

// Identifiers never reach channel agents, whatever the model chose.
const IDENTIFIER =
  /policy (number|no|#)|\bvin\b|licen[cs]e(?!d)|date of birth|\bdob\b|account|street|address|member id|group number|named insured|^name$/i;

// What she pays now and how much it went up weakens the ask if said aloud.
const PRICE = /premium|increase|change from|payment/i;

function guard(f: Fact): Fact {
  if (IDENTIFIER.test(f.label) && !/city|zip/i.test(f.label))
    return { ...f, disclosure: "hidden" as Disclosure };
  if (PRICE.test(f.label) && f.disclosure === "shareable") return { ...f, disclosure: "private" };
  return f;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)[0] ?? "policy";

// "Annual mileage" and "Annual mileage on file", "Uninsured motorist BI" and "Uninsured motorist" are the same thing.
const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(on file|bi|limits?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function sameLabel(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
}

const cleanInsurer = (name: string) =>
  name
    .replace(/[,\s]+(insurance company|insurance co\.?|insurance|company|inc\.?|llc)$/i, "")
    .trim();

async function extract(input: DecPageInput) {
  const content: (
    | { type: "text"; text: string }
    | { type: "file"; data: Uint8Array; mediaType: string; filename?: string }
  )[] = [];
  if (input.pdf)
    content.push({
      type: "file",
      data: input.pdf.data,
      mediaType: "application/pdf",
      filename: input.pdf.filename,
    });
  if (input.text?.trim()) content.push({ type: "text", text: input.text.slice(0, 40_000) });
  if (!content.length) throw new Error("Empty declarations page");
  content.push({ type: "text", text: "Extract this declarations page." });

  const { text } = await generateText({
    model: getModel("smart"),
    system: `${SYSTEM}\n\nRespond with a single JSON object only. No prose, no code fences.`,
    messages: [{ role: "user", content }],
    timeout: 60_000,
    maxRetries: 1,
  });
  const parsed = Out.safeParse(extractJson(text));
  if (!parsed.success)
    throw new Error(`Couldn't read the declarations page: ${parsed.error.message}`);
  return parsed.data;
}

export async function parseDecPage(input: DecPageInput): Promise<DecPageResult> {
  const out = await extract(input);
  const kind = out.kind.toLowerCase().trim();
  const monthlyPremium = Math.round((out.premium / out.premiumTermMonths) * 100) / 100;

  const policies = await store.policies();
  const existing = policies.find((p) => p.kind === kind && slug(p.insurer) === slug(out.insurer));
  const id = existing?.id ?? `${kind}-${slug(cleanInsurer(out.insurer))}`;

  // Keep the rules and requirements the user already set; the page only knows what's on it.
  // A removed seed policy coming back (demo start) still gets the rules the user set for it.
  const prior = existing?.coverage ?? COVERAGE[id];
  const before = prior?.items ?? [];
  const coverage: Coverage = {
    summary: out.coverage.summary,
    items: out.coverage.items.map((i) => {
      const prev = before.find((b) => sameLabel(b.label, i.label));
      return {
        label: i.label,
        value: i.value,
        ...(i.deductible ? { deductible: i.deductible } : {}),
        mustKeep: prev?.mustKeep ?? i.mustKeep,
        ...(prev?.rule ? { rule: prev.rule } : {}),
      };
    }),
    requirements: prior?.requirements ?? [],
  };

  const facts = out.facts.map(guard);
  // A hidden replacement must not swallow a shareable fact the agents still need (e.g. "Vehicle").
  for (const f of existing?.facts ?? []) {
    const replaced = facts.some(
      (n) =>
        sameLabel(n.label, f.label) && (n.disclosure !== "hidden" || f.disclosure === "hidden"),
    );
    if (!replaced) facts.push(f);
  }

  const policy: Policy = {
    id,
    personId: existing?.personId ?? PERSON_ID,
    kind,
    insurer: existing?.insurer ?? cleanInsurer(out.insurer),
    product: out.product,
    monthlyPremium,
    renewsOn: out.renewsOn,
    memberSince: out.memberSince ?? existing?.memberSince ?? new Date().getFullYear(),
    ...((out.phone ?? existing?.phone) ? { phone: out.phone ?? existing?.phone } : {}),
    facts,
    coverage,
  };
  await store.putPolicy(policy);
  return { policy, created: !existing, previousPremium: existing?.monthlyPremium };
}
