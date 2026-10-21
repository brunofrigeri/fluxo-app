import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "..", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
}

/** A fresh database with the Supabase stubs and migrations up to and including `upTo` (e.g. "0008"). */
export async function boot(upTo?: string): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(HERE, "stubs.sql"), "utf8"));
  for (const f of migrationFiles()) {
    if (upTo && f.slice(0, 4) > upTo) break;
    await applyMigration(db, f);
  }
  await db.exec("grant usage on schema public, auth, storage to authenticated; grant all on all tables in schema public, storage to authenticated; grant execute on all functions in schema public, auth, storage to authenticated;");
  return db;
}

export async function applyMigration(db: PGlite, file: string): Promise<void> {
  // pgcrypto is not needed: gen_random_uuid() is built in since Postgres 13.
  const sql = readFileSync(join(MIGRATIONS, file), "utf8").replace(/create extension if not exists pgcrypto;/g, "");
  try {
    await db.exec(sql);
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

/** Runs `fn` as the given signed-in user (RLS applies), then goes back to the superuser. */
export async function as<T>(db: PGlite, userId: string, fn: () => Promise<T>): Promise<T> {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
  await db.exec("set role authenticated");
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** Resolves to the error message when `fn` fails, or null when it succeeds. */
export async function fails(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
