import { neon } from "@neondatabase/serverless";
import type { Call } from "./types";

const sql = () => neon(process.env.DATABASE_URL!);

export async function claimNext(machineId: string): Promise<Call | undefined> {
  const rows = (await sql()`
    update docs set data = data || jsonb_build_object('machineId', ${machineId}::text, 'claimable', false), updated_at = now()
    where collection = 'call' and id = (
      select id from docs
      where collection = 'call'
        and data->>'claimable' = 'true'
        and data->>'machineId' is null
        and data->>'status' <> 'ended'
        and updated_at > now() - interval '10 minutes'
      order by updated_at
      limit 1
      for update skip locked
    )
    returning data`) as { data: Call }[];
  return rows[0]?.data;
}

export async function withdraw(callId: string): Promise<boolean> {
  const rows = (await sql()`
    update docs set data = data || jsonb_build_object('claimable', false), updated_at = now()
    where collection = 'call' and id = ${callId} and data->>'machineId' is null and data->>'claimable' = 'true'
    returning id`) as { id: string }[];
  return rows.length > 0;
}

const api = (path: string, init?: RequestInit) =>
  fetch(`https://api.machines.dev/v1/apps/${process.env.FLY_APP_NAME}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.FLY_API_TOKEN}`, "Content-Type": "application/json", ...init?.headers },
  });

interface Machine {
  id: string;
  state: string;
  config?: { metadata?: Record<string, string>; image?: string };
}

export async function poolStatus() {
  const res = await api("/machines");
  if (!res.ok) throw new Error(`Fly Machines API ${res.status}: ${await res.text()}`);
  const machines = ((await res.json()) as Machine[]).filter((m) => m.config?.metadata?.role === "pool");
  return machines.map((m) => ({ id: m.id, state: m.state, image: m.config?.image }));
}

export async function ensurePool(size: number) {
  const all = await poolStatus();
  const stopped = all.filter((m) => m.state === "stopped" || m.state === "suspended");
  await Promise.all(stopped.map((m) => api(`/machines/${m.id}/start`, { method: "POST" })));
  const existing = all.filter((m) => ["started", "starting", "created", "stopped", "suspended"].includes(m.state));
  const stale = existing.filter((m) => m.image && process.env.FLY_IMAGE_REF && !m.image.endsWith(process.env.FLY_IMAGE_REF.split(":").pop()!));
  const created: string[] = [];
  for (let i = existing.length; i < size; i++) {
    const res = await api("/machines", {
      method: "POST",
      body: JSON.stringify({
        region: process.env.FLY_REGION,
        config: {
          image: process.env.FLY_IMAGE_REF,
          env: { ROLE: "pool" },
          init: { cmd: ["npx", "tsx", "worker/negotiate.ts"] },
          restart: { policy: "always" },
          guest: { cpu_kind: "shared", cpus: 1, memory_mb: 1024 },
          metadata: { role: "pool" },
        },
      }),
    });
    if (!res.ok) throw new Error(`Fly Machines API ${res.status}: ${await res.text()}`);
    created.push(((await res.json()) as Machine).id);
  }
  return { running: existing.length, created, stale: stale.map((m) => m.id) };
}

export async function drainPool() {
  const machines = await poolStatus();
  await Promise.all(machines.map((m) => api(`/machines/${m.id}?force=true`, { method: "DELETE" })));
  return machines.length;
}
