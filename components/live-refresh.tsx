"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const source = new EventSource("/api/events");
    source.onmessage = (e) => {
      const data = JSON.parse(e.data) as { type: string };
      if (data.type === "hello") return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);
  return null;
}
