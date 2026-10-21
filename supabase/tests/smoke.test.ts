import assert from "node:assert/strict";
import { test } from "node:test";
import { boot } from "./db";

test("all migrations apply on a fresh database", async () => {
  const db = await boot();
  const r = await db.query<{ key: string }>("select key from modalities order by sort");
  assert.deepEqual(r.rows.map((x) => x.key), ["pilates", "acupuncture"]);
});
