"use client";

import { useState } from "react";

type Offer = { headline: string; percentOff: number; months: number; monthly: number } | null;

const REASONS = [
  { id: "price", label: "It's too expensive" },
  { id: "switching", label: "I found another insurer" },
  { id: "other", label: "Something else" },
];

// Stable ids and data attributes: the retention probe drives this page in a Kernel browser.
export function CancelFlow({ slug, accent }: { slug: string; accent: string }) {
  const [step, setStep] = useState<"reason" | "offer" | "confirm" | "done">("reason");
  const [reason, setReason] = useState("price");
  const [offer, setOffer] = useState<Offer>(null);
  const [typed, setTyped] = useState("");
  const [premium, setPremium] = useState<number>();

  const post = (body: object) =>
    fetch(`/api/insurers/${slug}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());

  const button = "min-h-11 rounded-lg px-4 text-[15px] font-semibold";

  if (step === "reason")
    return (
      <form
        data-step="reason"
        className="flex flex-col gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await post({ step: "reason", reason });
          setOffer(res.offer);
          setPremium(res.premium);
          setStep(res.offer ? "offer" : "confirm");
        }}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[15px] font-medium">Why are you leaving?</legend>
          {REASONS.map((r) => (
            <label
              key={r.id}
              className="flex items-center gap-3 rounded-lg border border-[#dfe2e8] px-4 py-3"
            >
              <input
                id={`reason-${r.id}`}
                type="radio"
                name="reason"
                checked={reason === r.id}
                onChange={() => setReason(r.id)}
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <button
          id="continue"
          type="submit"
          className={button}
          style={{ background: accent, color: "white" }}
        >
          Continue
        </button>
      </form>
    );

  if (step === "offer" && offer)
    return (
      <section data-step="offer" className="flex flex-col gap-4">
        <div
          data-retention-offer
          data-monthly={offer.monthly}
          data-percent={offer.percentOff}
          data-months={offer.months}
          className="flex flex-col gap-2 rounded-xl border-2 p-5"
          style={{ borderColor: accent }}
        >
          <p className="text-[19px] font-semibold">{offer.headline}</p>
          <p className="text-[15px]">
            Stay with us and pay <strong>${offer.monthly}/mo</strong> instead of ${premium}/mo for
            the next {offer.months} months ({offer.percentOff}% off).
          </p>
        </div>
        <button
          id="accept-offer"
          className={button}
          style={{ background: accent, color: "white" }}
          onClick={() => setStep("done")}
        >
          Keep my policy at ${offer.monthly}/mo
        </button>
        <button
          id="decline-offer"
          className={`${button} border border-[#dfe2e8]`}
          onClick={() => setStep("confirm")}
        >
          No thanks, continue cancelling
        </button>
      </section>
    );

  if (step === "confirm")
    return (
      <section data-step="confirm" className="flex flex-col gap-4">
        <p className="text-[15px]">
          Type <strong>CANCEL</strong> to end your policy. Coverage stops at midnight.
        </p>
        <input
          id="confirm-input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          className="min-h-11 rounded-lg border border-[#dfe2e8] px-3"
        />
        <button
          id="confirm-cancel"
          disabled={typed !== "CANCEL"}
          className={`${button} bg-[#b3261e] text-white disabled:opacity-40`}
          onClick={async () => {
            await post({ step: "confirm", typed });
            setStep("done");
          }}
        >
          Confirm cancellation
        </button>
      </section>
    );

  return (
    <p data-step="done" className="text-[15px]">
      Done. You'll get an email confirmation.
    </p>
  );
}
