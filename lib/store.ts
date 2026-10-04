import { EventEmitter } from "node:events";
import { neon } from "@neondatabase/serverless";
import { withCoverage } from "./coverage";
import * as seed from "./seed";
import type { Call, MemberRate, Person, Policy, PriceCandidate, Signal, Stance, StoreEvent, Transaction } from "./types";

type Collection = "person" | "policy" | "stance" | "signal" | "transaction" | "member_rate" | "call" | "price";

interface Backend {
  all<T>(collection: Collection): Promise<T[]>;
  get<T>(collection: Collection, id: string): Promise<T | undefined>;
  put<T>(collection: Collection, id: string, data: T): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
}

function seedDocs(): Record<Collection, Map<string, unknown>> {
  const m = (items: { id?: string; policyId?: string }[], key: (x: any) => string) =>
    new Map(items.map((x) => [key(x), structuredClone(x)]));
  return {
    person: m([seed.person], (x) => x.id),
    policy: m(seed.policies, (x) => x.id),
    stance: m(seed.stances, (x) => x.policyId),
    signal: m(seed.signals, (x) => x.id),
    transaction: m(seed.transactions, (x) => x.id),
    member_rate: m(seed.memberRates, (x) => x.id),
    call: new Map(),
    price: new Map(),
  };
}

class MemoryBackend implements Backend {
  docs = seedDocs();
  async all<T>(c: Collection) {
    return [...this.docs[c].values()] as T[];
  }
  async get<T>(c: Collection, id: string) {
    return this.docs[c].get(id) as T | undefined;
  }
  async put<T>(c: Collection, id: string, data: T) {
    this.docs[c].set(id, data);
  }
  async remove(c: Collection, id: string) {
    this.docs[c].delete(id);
  }
}

class NeonBackend implements Backend {
  sql = neon(process.env.DATABASE_URL!);
  async all<T>(c: Collection) {
    const rows = (await this.sql`select data from docs where collection = ${c} order by updated_at`) as { data: T }[];
    return rows.map((r) => r.data);
  }
  async get<T>(c: Collection, id: string) {
    const rows = (await this.sql`select data from docs where collection = ${c} and id = ${id}`) as { data: T }[];
    return rows[0]?.data;
  }
  async put<T>(c: Collection, id: string, data: T) {
    await this.sql`insert into docs (collection, id, data, updated_at) values (${c}, ${id}, ${JSON.stringify(data)}::jsonb, now())
      on conflict (collection, id) do update set data = excluded.data, updated_at = now()`;
  }
  async remove(c: Collection, id: string) {
    await this.sql`delete from docs where collection = ${c} and id = ${id}`;
  }
}

const g = globalThis as unknown as { __store?: { backend: Backend; bus: EventEmitter } };

function state() {
  if (!g.__store) {
    const bus = new EventEmitter();
    bus.setMaxListeners(100);
    g.__store = { backend: process.env.DATABASE_URL ? new NeonBackend() : new MemoryBackend(), bus };
  }
  return g.__store;
}

function emit(event: StoreEvent) {
  state().bus.emit("event", event);
}

const poller = globalThis as unknown as { __storePoll?: ReturnType<typeof setInterval> };

function startPolling() {
  const backend = state().backend;
  if (!(backend instanceof NeonBackend) || poller.__storePoll) return;
  let since = new Date().toISOString();
  poller.__storePoll = setInterval(async () => {
    try {
      const rows = (await backend.sql`select collection, data, updated_at from docs where updated_at > ${since} order by updated_at`) as {
        collection: Collection;
        data: any;
        updated_at: string | Date;
      }[];
      for (const r of rows) {
        since = new Date(r.updated_at).toISOString();
        if (r.collection === "call") emit({ type: "call", call: r.data });
        else if (r.collection === "stance") emit({ type: "stance", stance: r.data });
        else if (r.collection === "signal") emit({ type: "signal", signal: r.data });
        else if (r.collection === "policy") emit({ type: "policy", policy: r.data });
        else if (r.collection === "price") emit({ type: "price", price: r.data });
      }
    } catch (e) {
      console.error("[store poll]", e);
    }
  }, 1000);
}

export function subscribe(fn: (e: StoreEvent) => void) {
  startPolling();
  state().bus.on("event", fn);
  return () => {
    state().bus.off("event", fn);
  };
}

const db = () => state().backend;

export const store = {
  async person(): Promise<Person> {
    return (await db().get<Person>("person", seed.PERSON_ID))!;
  },
  async putPerson(p: Person) {
    await db().put("person", p.id, p);
  },
  async policies(): Promise<Policy[]> {
    return (await db().all<Policy>("policy")).map((p) => withCoverage(p));
  },
  async policy(id: string) {
    return withCoverage(await db().get<Policy>("policy", id));
  },
  async putPolicy(p: Policy) {
    await db().put("policy", p.id, p);
    emit({ type: "policy", policy: p });
  },
  async stances(): Promise<Stance[]> {
    return db().all<Stance>("stance");
  },
  async stance(policyId: string) {
    return db().get<Stance>("stance", policyId);
  },
  async putStance(s: Stance) {
    await db().put("stance", s.policyId, s);
    emit({ type: "stance", stance: s });
  },
  async signals(policyId?: string): Promise<Signal[]> {
    const all = await db().all<Signal>("signal");
    return all.filter((s) => !policyId || s.policyId === policyId).sort((a, b) => b.at.localeCompare(a.at));
  },
  async addSignal(s: Signal) {
    await db().put("signal", s.id, s);
    emit({ type: "signal", signal: s });
  },
  async clearSignals(filter: (s: Signal) => boolean) {
    for (const s of await db().all<Signal>("signal")) if (filter(s)) await db().remove("signal", s.id);
  },
  async transactions(): Promise<Transaction[]> {
    const all = await db().all<Transaction>("transaction");
    return all.sort((a, b) => a.date.localeCompare(b.date));
  },
  async memberRates(filter?: Partial<Pick<MemberRate, "insurer" | "kind">>): Promise<MemberRate[]> {
    const all = await db().all<MemberRate>("member_rate");
    return all.filter((m) => (!filter?.insurer || m.insurer === filter.insurer) && (!filter?.kind || m.kind === filter.kind));
  },
  async prices(policyId?: string): Promise<PriceCandidate[]> {
    const all = await db().all<PriceCandidate>("price");
    return policyId ? all.filter((p) => p.policyId === policyId) : all;
  },
  async putPrice(p: PriceCandidate) {
    await db().put("price", p.id, p);
    emit({ type: "price", price: p });
  },
  async removePrice(id: string) {
    await db().remove("price", id);
  },
  async call(id: string) {
    return db().get<Call>("call", id);
  },
  async calls(): Promise<Call[]> {
    return db().all<Call>("call");
  },
  async activeCall(): Promise<Call | undefined> {
    return (await db().all<Call>("call")).find((c) => c.status !== "ended");
  },
  async putCall(c: Call) {
    await db().put("call", c.id, c);
    emit({ type: "call", call: c });
  },
  async reset() {
    const docs = seedDocs();
    for (const [c, items] of Object.entries(docs) as [Collection, Map<string, unknown>][]) {
      for (const existing of await db().all<{ id?: string; policyId?: string }>(c)) {
        await db().remove(c, (existing.id ?? existing.policyId)!);
      }
      for (const [id, data] of items) await db().put(c, id, data);
    }
  },
};
