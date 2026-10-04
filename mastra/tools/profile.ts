import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { DOMAINS, estimate, readValues, valuesAfter, type FactChange } from "@/lib/profile";
import { store } from "@/lib/store";

export const profileRead = createTool({
  id: "profileRead",
  description:
    "Read Maya's profile: every fact on her and on each policy, grouped by domain, with disclosure level. Sealed (hidden) values are masked. Also lists the editable fields with their allowed options.",
  inputSchema: z.object({}),
  execute: async () => {
    const [person, policies] = await Promise.all([store.person(), store.policies()]);
    const show = (f: { label: string; value: string; disclosure: string }) => ({
      ...f,
      value: f.disclosure === "hidden" ? "(sealed)" : f.value,
    });
    return {
      person: {
        name: person.name,
        city: person.city,
        state: person.state,
        facts: person.facts.map(show),
      },
      policies: policies.map((p) => ({
        id: p.id,
        kind: p.kind,
        insurer: p.insurer,
        product: p.product,
        monthlyPremium: p.monthlyPremium,
        facts: p.facts.map(show),
      })),
      editable: DOMAINS.map((d) => ({
        domain: d.title,
        fields: d.fields.map((f) => ({
          owner: f.owner,
          label: f.fact,
          type: f.type,
          options: f.options,
        })),
      })),
      current: readValues(person, policies),
    };
  },
});

const Change = z.object({
  action: z.enum(["set", "add", "remove"]),
  owner: z.string().describe('"person" or a policy id such as auto-northstar'),
  label: z.string().describe("Fact label, e.g. 'Annual mileage on file' or a new label"),
  value: z.string().optional(),
  disclosure: z
    .enum(["shareable", "private", "hidden"])
    .optional()
    .describe(
      "New facts: shareable only if insurers may hear it; private for things used but never said; hidden for identifiers",
    ),
  reason: z
    .string()
    .optional()
    .describe("What Maya said that justifies this change, in a few words"),
});

export const profilePropose = createTool({
  id: "profilePropose",
  description:
    "Propose changes to Maya's profile (set, add or remove facts) once you're sure what she means. Returns the estimated effect on her premiums. Nothing is saved: Maya sees a card and applies or discards it.",
  inputSchema: z.object({
    summary: z.string().describe("One sentence describing the change"),
    changes: z.array(Change).min(1),
  }),
  execute: async ({ summary, changes }) => {
    const [person, policies, stances] = await Promise.all([
      store.person(),
      store.policies(),
      store.stances(),
    ]);
    const base = readValues(person, policies);
    const fair = Object.fromEntries(stances.map((s) => [s.policyId, s.fairMonthly]));
    const effects = estimate(
      policies,
      fair,
      base,
      valuesAfter(base, changes as FactChange[]),
    ).filter((e) => e.to !== e.from);
    const before = (c: FactChange) =>
      (c.owner === "person" ? person.facts : policies.find((p) => p.id === c.owner)?.facts)?.find(
        (f) => f.label === c.label,
      )?.value;
    return {
      summary,
      changes: (changes as FactChange[]).map((c) => ({ ...c, before: before(c) })),
      effects: effects.map((e) => ({
        policyId: e.policyId,
        insurer: e.insurer,
        kind: e.kind,
        from: e.from,
        to: e.to,
        reasons: e.reasons,
      })),
      totalDelta: effects.reduce((a, e) => a + e.to - e.from, 0),
    };
  },
});
