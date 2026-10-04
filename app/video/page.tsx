import type { Metadata } from "next";
import Link from "next/link";
import { Back } from "@/components/icons";

export const metadata: Metadata = {
  title: "Service Haggle · Demo",
  description: "Watch Service Haggle find a better price and negotiate it for you.",
};

export default function VideoPage() {
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-6 px-5 pt-7 pb-14">
      <Link
        href="/"
        className="-my-2.5 -ml-1 inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-medium text-muted hover:text-ink"
      >
        <Back />
        All policies
      </Link>
      <h1 className="text-[32px] leading-[38px] font-semibold tracking-[-0.03em]">Service Haggle in 36 seconds</h1>
      <video
        src="/service-haggle-demo.mp4"
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full rounded-[18px] bg-black shadow-[0_0_0_1px_var(--color-line)]"
      />
    </main>
  );
}
