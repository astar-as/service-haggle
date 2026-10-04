import type { Metadata, Viewport } from "next";
import { Receiver } from "@/components/receiver";
import { DEMO_TARGETS } from "@/lib/agents";

export const metadata: Metadata = { title: "Broker line" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f7f8" };

export default async function ReceiverPage({ params }: { params: Promise<{ slot: string }> }) {
  const { slot } = await params;
  const assigned = Object.values(DEMO_TARGETS)
    .flat()
    .find((t) => t.slot === slot);
  return <Receiver slot={slot} insurer={assigned?.insurer ?? "Insurance broker"} name={assigned?.name ?? ""} />;
}
