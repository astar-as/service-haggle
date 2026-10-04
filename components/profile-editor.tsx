"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  DOMAINS,
  estimate,
  FIELDS,
  formatValue,
  num,
  type ProfileField,
  type Values,
} from "@/lib/profile";
import type { Disclosure, Person, Policy } from "@/lib/types";
import { kindLabel, usd } from "@/lib/view";

const card = "overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]";

const DISCLOSURE: Record<Disclosure, { label: string; className: string }> = {
  shareable: { label: "Shareable", className: "text-subtle" },
  private: { label: "Private · used, never said", className: "text-accent" },
  hidden: { label: "Sealed", className: "text-faint" },
};

export function ProfileEditor({
  person,
  policies,
  fair,
  initial,
}: {
  person: Person;
  policies: Policy[];
  fair: Record<string, number>;
  initial: Values;
}) {
  const router = useRouter();
  const [base, setBase] = useState(initial);
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const estimates = useMemo(
    () => estimate(policies, fair, base, values),
    [policies, fair, base, values],
  );
  const changed = FIELDS.filter((f) => values[f.id] !== base[f.id]);
  const moved = estimates.filter((e) => e.to !== e.from);
  const totalFrom = estimates.reduce((a, e) => a + e.from, 0);
  const totalTo = estimates.reduce((a, e) => a + e.to, 0);
  const diff = totalTo - totalFrom;

  const set = (id: string, v: string) => {
    setSaved(false);
    setValues((cur) => ({ ...cur, [id]: v }));
  };

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values }),
      });
      if (!res.ok) throw new Error(await res.text());
      setBase(values);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section aria-labelledby="whatif" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="whatif" className="text-[15px] leading-[22px] font-semibold">
            What if
          </h2>
          <span className="num text-sm text-subtle">{usd(totalFrom)}/mo today</span>
        </div>
        <div className={card}>
          {changed.length === 0 ? (
            <p className="px-5 py-[18px] text-base leading-[23px] text-subtle">
              {saved
                ? "Saved. I'll use the new facts on the next call."
                : "Change a value below to see how your premiums would move."}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-5 pb-4">
                <span className="num text-[40px] leading-[44px] font-semibold tracking-[-0.04em]">
                  {usd(totalTo)}
                </span>
                <span
                  className={`num text-lg font-semibold ${diff < 0 ? "text-money" : diff > 0 ? "text-accent" : "text-subtle"}`}
                >
                  {diff === 0 ? "no change" : `${diff < 0 ? "−" : "+"}${usd(Math.abs(diff))}/mo`}
                </span>
                <span className="text-sm text-subtle">estimated, at your next renewal</span>
              </div>
              {moved.map((e) => (
                <div
                  key={e.policyId}
                  className="flex flex-col gap-1 border-t border-hair px-5 py-[14px]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-base leading-[22px] font-semibold">
                      {kindLabel(e.kind)}{" "}
                      <span className="font-normal text-subtle">· {e.insurer}</span>
                    </span>
                    <span className="num text-base">
                      <span className="text-subtle line-through decoration-faint">
                        {usd(e.from)}
                      </span>{" "}
                      <span
                        className={`font-semibold ${e.to < e.from ? "text-money" : "text-accent"}`}
                      >
                        {usd(e.to)}
                      </span>
                    </span>
                  </div>
                  <span className="text-sm leading-5 text-subtle">
                    {e.reasons
                      .map((r) => `${r.label} (${r.pct > 0 ? "+" : ""}${r.pct}%)`)
                      .join(" · ")}
                    {e.fairTo !== undefined &&
                      e.fairTo !== e.fairFrom &&
                      ` · fair moves to about ${usd(e.fairTo)}`}
                  </span>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 border-t border-hair px-5 py-4">
                <button
                  onClick={save}
                  disabled={saving}
                  className="min-h-11 rounded-xl bg-accent px-4 text-[15px] font-semibold text-white transition-transform duration-150 ease-out-strong active:scale-[0.99] disabled:opacity-50"
                >
                  {saving
                    ? "Saving…"
                    : `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`}
                </button>
                <button
                  onClick={() => setValues(base)}
                  className="min-h-11 rounded-xl px-3 text-[15px] font-medium text-muted hover:text-ink"
                >
                  Reset
                </button>
                <span className="text-[13px] leading-[18px] text-faint">
                  Rough rating-factor estimates, not quotes.
                </span>
              </div>
            </>
          )}
        </div>
      </section>

      {DOMAINS.map((d) => {
        const policy = policies.find((p) => p.id === d.policyId);
        const owner = d.policyId ? policy?.facts : person.facts;
        const mapped = new Set(d.fields.map((f) => f.fact));
        const extra = (owner ?? []).filter((f) => !mapped.has(f.label));
        return (
          <section key={d.id} aria-labelledby={`d-${d.id}`} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h2 id={`d-${d.id}`} className="text-[15px] leading-[22px] font-semibold">
                {d.title}
              </h2>
              {policy && (
                <a href={`/policy/${policy.id}`} className="num text-sm text-subtle hover:text-ink">
                  {policy.insurer} · {usd(policy.monthlyPremium)}/mo
                </a>
              )}
            </div>
            <div
              className={`${card} grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))]`}
            >
              {d.fields.map((f) => (
                <Field
                  key={f.id}
                  field={f}
                  value={values[f.id]}
                  changed={values[f.id] !== base[f.id]}
                  onChange={(v) => set(f.id, v)}
                />
              ))}
              {extra.map((f) => (
                <div
                  key={f.label}
                  className="flex flex-col gap-1 px-5 py-4 shadow-[inset_0_0_0_0.5px_var(--color-hair)]"
                >
                  <span className="text-[13px] leading-[18px] text-subtle">{f.label}</span>
                  <span className="num text-base leading-[22px] font-semibold">
                    {f.disclosure === "hidden" ? "••••••" : f.value}
                  </span>
                  <span className={`text-[12px] leading-4 ${DISCLOSURE[f.disclosure].className}`}>
                    {DISCLOSURE[f.disclosure].label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

function Field({
  field: f,
  value,
  changed,
  onChange,
}: {
  field: ProfileField;
  value: string;
  changed: boolean;
  onChange: (v: string) => void;
}) {
  const id = `field-${f.id}`;
  const control =
    "num -mx-1 min-h-9 w-full rounded-lg bg-transparent px-1 text-base leading-[22px] font-semibold outline-none hover:bg-canvas focus-visible:bg-canvas focus-visible:ring-2 focus-visible:ring-accent";
  return (
    <div
      className={`flex flex-col gap-1 px-5 py-4 shadow-[inset_0_0_0_0.5px_var(--color-hair)] ${changed ? "bg-accent-soft" : ""}`}
    >
      <label htmlFor={id} className="text-[13px] leading-[18px] text-subtle">
        {f.label}
      </label>
      {f.type === "select" ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={control}
        >
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : (
        <div className="flex items-baseline">
          {f.prefix && <span className="text-base font-semibold">{f.prefix}</span>}
          <input
            id={id}
            inputMode="numeric"
            value={num(value) ? num(value).toLocaleString("en-US") : ""}
            onChange={(e) => onChange(String(num(e.target.value)))}
            className={control}
            aria-describedby={f.hint ? `${id}-hint` : undefined}
          />
          {f.suffix && <span className="shrink-0 text-sm text-subtle">{f.suffix.trim()}</span>}
        </div>
      )}
      <span
        id={`${id}-hint`}
        className={`text-[12px] leading-4 ${DISCLOSURE[f.disclosure].className}`}
      >
        {f.hint ? `${f.hint} · ` : ""}
        {DISCLOSURE[f.disclosure].label}
      </span>
      <span className="sr-only">{formatValue(f, value)}</span>
    </div>
  );
}
