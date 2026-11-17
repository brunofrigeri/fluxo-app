import type { SupabaseClient } from "@supabase/supabase-js";

export type Call = { table: string; ops: [string, unknown[]][] };

/**
 * A stand-in for the Supabase query builder. Every builder method is recorded and returns the builder; awaiting
 * it resolves to what `respond` returns for that call. Good for asserting what a function sends, not for RLS
 * (that is covered by the SQL tests and the integration tests against a real local Supabase).
 */
export function stubClient(respond: (call: Call) => { data?: unknown; error?: { code?: string; message: string } | null } = () => ({ data: [{ id: "row" }], error: null })) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const b: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "upsert", "delete", "eq", "in", "gte", "lte", "order", "limit", "is", "not", "or", "range"]) {
      b[m] = (...args: unknown[]) => {
        call.ops.push([m, args]);
        return b;
      };
    }
    b.single = b.maybeSingle = () => Promise.resolve({ error: null, ...respond(call) });
    b.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve({ error: null, ...respond(call) }).then(ok, bad);
    return b;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

export const op = (call: Call, name: string) => call.ops.find(([n]) => n === name)?.[1];
