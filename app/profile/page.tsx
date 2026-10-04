import Link from "next/link";
import { Back } from "@/components/icons";
import { ProfileEditor } from "@/components/profile-editor";
import { readValues } from "@/lib/profile";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [person, policies, stances] = await Promise.all([
    store.person(),
    store.policies(),
    store.stances(),
  ]);
  const fair = Object.fromEntries(stances.map((s) => [s.policyId, s.fairMonthly]));
  const age = person.facts.find((f) => f.label === "Age")?.value;

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-9 px-5 pt-7 pb-14">
      <Link
        href="/"
        className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium text-muted hover:text-ink"
      >
        <Back />
        All policies
      </Link>
      <section className="flex flex-col gap-2">
        <span className="text-sm leading-5 text-subtle">
          {age ? `${age} · ` : ""}
          {person.city}, {person.state} · {policies.length} policies
        </span>
        <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">
          {person.name}
        </h1>
        <p className="mt-1 text-[17px] leading-[26px] text-pretty text-ink-2">
          Everything I know about you, grouped by what it prices. Change a value to see how your
          premiums would move. Only shareable facts ever reach an insurer.
        </p>
      </section>
      <ProfileEditor
        person={person}
        policies={policies}
        fair={fair}
        initial={readValues(person, policies)}
      />
    </main>
  );
}
