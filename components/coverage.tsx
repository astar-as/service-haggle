import type { Coverage } from "@/lib/types";

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-[3px] flex-none text-money">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function CoverageTable({ coverage }: { coverage: Coverage }) {
  return (
    <section aria-labelledby="coverage" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 px-1">
        <h2 id="coverage" className="text-[15px] leading-[22px] font-semibold">
          Coverage
        </h2>
        <span className="truncate text-sm text-subtle">{coverage.summary}</span>
      </div>
      <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
        {coverage.items.map((i) => (
          <div key={i.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-hair px-5 py-3.5 first:border-t-0">
            <span className="flex min-w-[180px] flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 text-[15px] leading-[22px] font-medium">
                {i.label}
                {i.mustKeep && <span className="rounded-full bg-accent-soft px-2 py-px text-[11px] leading-4 font-semibold text-accent">Must keep</span>}
              </span>
              {i.rule && <span className="text-[13px] leading-[18px] text-subtle">{i.rule}</span>}
            </span>
            <span className="num text-right text-[15px] leading-[22px] font-semibold">
              {i.value}
              {i.deductible && <span className="block text-[13px] leading-[18px] font-normal text-subtle">{i.deductible} deductible</span>}
            </span>
          </div>
        ))}
      </div>
      {coverage.requirements.length > 0 && <Requirements items={coverage.requirements} />}
    </section>
  );
}

export function Requirements({ items, title = "Any new offer must also" }: { items: string[]; title?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-white px-5 py-4 shadow-[0_0_0_1px_var(--color-line)]">
      <span className="text-[13px] leading-[18px] font-semibold text-subtle">{title}</span>
      <ul className="flex flex-col gap-1.5">
        {items.map((r) => (
          <li key={r} className="flex gap-2.5 text-[15px] leading-[22px]">
            <Check />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MustMatch({ coverage }: { coverage: Coverage }) {
  const must = coverage.items.filter((i) => i.mustKeep);
  return (
    <section aria-labelledby="must-match" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4 px-1">
        <h2 id="must-match" className="text-[15px] leading-[22px] font-semibold">
          Every offer must match
        </h2>
        <span className="text-sm text-subtle">Agents only accept identical cover</span>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] overflow-hidden rounded-[18px] bg-white shadow-[0_0_0_1px_var(--color-line)]">
        {must.map((i) => (
          <div key={i.label} className="flex flex-col gap-0.5 px-5 py-3.5 shadow-[inset_0_0_0_0.5px_var(--color-hair)]">
            <span className="text-[13px] leading-[18px] text-subtle">{i.label}</span>
            <span className="num text-[15px] leading-[22px] font-semibold">
              {i.value}
              {i.deductible ? ` · ${i.deductible} ded.` : ""}
            </span>
          </div>
        ))}
      </div>
      {coverage.requirements.length > 0 && <Requirements items={coverage.requirements} title="And" />}
    </section>
  );
}
