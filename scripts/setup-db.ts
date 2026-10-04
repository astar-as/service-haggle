import { neon } from "@neondatabase/serverless";
import { store } from "../lib/store";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  await sql`create table if not exists docs (
    collection text not null,
    id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (collection, id)
  )`;
  await sql`create index if not exists docs_updated_at on docs (updated_at)`;
  await store.reset();
  console.log("docs table ready and seeded");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
