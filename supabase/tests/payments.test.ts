import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { as, boot, fails } from "./db";

const id = (a: number, b: number) => `${a}0000000-0000-0000-0000-${String(b).padStart(12, "0")}`;
const S1 = id(1, 1), S2 = id(1, 2);
const ADMIN1 = id(2, 1), ADMIN2 = id(2, 2), INSTR = id(2, 3);
const C_MONTHLY = id(3, 1), C_31 = id(3, 2), C_NONE = id(3, 3), C_OTHER = id(3, 4), C_ARCHIVED = id(3, 5);

let db: PGlite;
const rows = async (sql: string, params?: unknown[]) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const cycles = (from: string | null, to: string) => rows("select client_name, due_date::text as due, status from payment_cycles($1, $2)", [from, to]);

before(async () => {
  db = await boot();
  const PIL = (await rows("select id from modalities where key = 'pilates'"))[0].id as string;
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN1}', 'a1@x'), ('${ADMIN2}', 'a2@x'), ('${INSTR}', 'i@x');
    insert into studios (id, name) values ('${S1}', 'S1'), ('${S2}', 'S2');
    insert into profiles (id, email, name, role, studio_id) values
      ('${ADMIN1}', 'a1@x', 'Admin1', 'admin', '${S1}'), ('${ADMIN2}', 'a2@x', 'Admin2', 'admin', '${S2}'), ('${INSTR}', 'i@x', 'Instr', 'instructor', '${S1}');
    insert into studio_modalities values ('${S1}', '${PIL}'), ('${S2}', '${PIL}');
    insert into clients (id, document, name, studio_id, billing_day, billing_since, active) values
      ('${C_MONTHLY}', '1', 'Mensal', '${S1}', 10, '2026-01-01', true),
      ('${C_31}', '2', 'Dia 31', '${S1}', 31, '2026-01-01', true),
      ('${C_OTHER}', '4', 'Outro estúdio', '${S2}', 10, '2026-01-01', true),
      ('${C_ARCHIVED}', '5', 'Arquivado', '${S1}', 10, '2026-01-01', false);
    insert into clients (id, document, name, studio_id) values ('${C_NONE}', '3', 'Sem dia', '${S1}');
    insert into user_modalities values ('${INSTR}', '${PIL}');
    insert into client_modality_instructors values ('${C_MONTHLY}', '${PIL}', '${INSTR}'), ('${C_31}', '${PIL}', '${INSTR}');
  `);
});

describe("billing day", () => {
  test("is limited to 1..31", async () => {
    assert.ok(await fails(() => db.exec(`update clients set billing_day = 32 where id = '${C_NONE}'`)));
    assert.ok(await fails(() => db.exec(`update clients set billing_day = 0 where id = '${C_NONE}'`)));
  });

  test("setting it starts the cycles today; changing it starts them again; clearing it stops them", async () => {
    await db.exec(`update clients set billing_day = 5 where id = '${C_NONE}'`);
    const since = (await rows(`select billing_since::text s, (now() at time zone 'America/Sao_Paulo')::date::text t from clients where id = '${C_NONE}'`))[0];
    assert.equal(since.s, since.t);
    await db.exec(`update clients set billing_since = '2026-01-01' where id = '${C_NONE}'`);
    await db.exec(`update clients set billing_day = 6 where id = '${C_NONE}'`);
    assert.equal((await rows(`select billing_since::text s from clients where id = '${C_NONE}'`))[0].s, since.t);
    await db.exec(`update clients set billing_day = null where id = '${C_NONE}'`);
    assert.equal((await rows(`select billing_since from clients where id = '${C_NONE}'`))[0].billing_since, null);
  });
});

describe("payment_cycles", () => {
  test("lists each due date of the month, pending until recorded, only for active clients with a day", async () => {
    const r = await as(db, ADMIN1, () => cycles("2026-03-01", "2026-03-31"));
    assert.deepEqual(r, [
      { client_name: "Mensal", due: "2026-03-10", status: "pending" },
      { client_name: "Dia 31", due: "2026-03-31", status: "pending" },
    ]);
  });

  test("day 31 falls on the last day of shorter months, including a leap February", async () => {
    const dia31 = (from: string, to: string) => as(db, ADMIN1, () => cycles(from, to)).then((r) => r.filter((x) => x.client_name === "Dia 31").map((x) => x.due));
    assert.deepEqual(await dia31("2027-02-01", "2027-02-28"), ["2027-02-28"]);
    assert.deepEqual(await dia31("2028-02-01", "2028-02-29"), ["2028-02-29"]);
    assert.deepEqual(await dia31("2026-04-01", "2026-04-30"), ["2026-04-30"]);
  });

  test("nothing before the client's billing_since", async () => {
    await db.exec(`update clients set billing_since = '2026-03-11' where id = '${C_MONTHLY}'`);
    const r = await as(db, ADMIN1, () => cycles("2026-03-01", "2026-03-31"));
    assert.deepEqual(r.map((x) => x.client_name), ["Dia 31"]); // the 10th is before 03-11
    const from = await as(db, ADMIN1, () => cycles(null, "2026-05-31"));
    assert.deepEqual(from.filter((x) => x.client_name === "Mensal").map((x) => x.due), ["2026-04-10", "2026-05-10"]);
    await db.exec(`update clients set billing_since = '2026-01-01' where id = '${C_MONTHLY}'`);
  });

  test("a null start covers every cycle since the billing began", async () => {
    const r = await as(db, ADMIN1, () => cycles(null, "2026-03-31"));
    assert.deepEqual(r.filter((x) => x.client_name === "Mensal").map((x) => x.due), ["2026-01-10", "2026-02-10", "2026-03-10"]);
  });

  test("shows what was recorded", async () => {
    await as(db, ADMIN1, () => db.exec(`insert into payments (client_id, due_date, status, paid_on) values ('${C_MONTHLY}', '2026-03-10', 'paid', '2026-03-09')`));
    const r = await as(db, ADMIN1, () => cycles("2026-03-01", "2026-03-31"));
    assert.equal(r.find((x) => x.client_name === "Mensal")?.status, "paid");
    await as(db, ADMIN1, () => db.exec(`update payments set status = 'unpaid', paid_on = null where client_id = '${C_MONTHLY}'`));
    assert.equal((await as(db, ADMIN1, () => cycles("2026-03-01", "2026-03-31"))).find((x) => x.client_name === "Mensal")?.status, "unpaid");
  });

  test("another studio's clients and instructors see nothing", async () => {
    const other = await as(db, ADMIN2, () => cycles("2026-03-01", "2026-03-31"));
    assert.deepEqual(other.map((x) => x.client_name), ["Outro estúdio"]);
    assert.deepEqual(await as(db, INSTR, () => cycles("2026-03-01", "2026-03-31")), []);
  });
});

describe("payments table", () => {
  test("only a date the billing day produces can be recorded", async () => {
    const err = await as(db, ADMIN1, () => fails(() => db.exec(`insert into payments (client_id, due_date, status) values ('${C_MONTHLY}', '2026-04-11', 'paid')`)));
    assert.match(err ?? "", /não corresponde/);
    const none = await fails(() => db.exec(`insert into payments (client_id, due_date, status) values ('${C_NONE}', '2026-04-11', 'paid')`));
    assert.match(none ?? "", /sem dia|não tem dia/i);
  });

  test("one record per client and due date", async () => {
    assert.ok(await fails(() => db.exec(`insert into payments (client_id, due_date, status) values ('${C_MONTHLY}', '2026-03-10', 'paid')`)));
  });

  test("an unpaid record has no paid_on", async () => {
    assert.ok(await fails(() => db.exec(`insert into payments (client_id, due_date, status, paid_on) values ('${C_MONTHLY}', '2026-04-10', 'unpaid', '2026-04-10')`)));
  });

  test("admins of the studio read and change it; instructors and other studios cannot", async () => {
    const n = async (who: string) => as(db, who, async () => Number((await rows("select count(*) n from payments"))[0].n));
    assert.equal(await n(ADMIN1), 1);
    assert.equal(await n(ADMIN2), 0);
    assert.equal(await n(INSTR), 0);
    assert.ok(await as(db, INSTR, () => fails(() => db.exec(`insert into payments (client_id, due_date, status) values ('${C_MONTHLY}', '2026-04-10', 'paid')`))));
    assert.ok(await as(db, ADMIN2, () => fails(() => db.exec(`insert into payments (client_id, due_date, status) values ('${C_MONTHLY}', '2026-04-10', 'paid')`))));
  });

  test("records who recorded it", async () => {
    assert.equal((await rows("select marked_by from payments limit 1"))[0].marked_by, ADMIN1);
  });
});

describe("receipts", () => {
  let paymentId: string;
  before(async () => {
    paymentId = (await rows("select id from payments limit 1"))[0].id as string;
    await db.exec(`
      insert into documents (client_id, name, storage_path, mime_type, size_bytes, payment_id) values ('${C_MONTHLY}', 'Comprovante', '${C_MONTHLY}/payments/r.pdf', 'application/pdf', 10, '${paymentId}');
      insert into documents (client_id, name, storage_path, mime_type, size_bytes) values ('${C_MONTHLY}', 'Exame', '${C_MONTHLY}/e.pdf', 'application/pdf', 10);
    `);
    await db.exec("insert into storage.buckets (id, name) values ('client-documents', 'client-documents') on conflict do nothing");
  });

  test("an instructor of the client sees the client's documents but not the receipts", async () => {
    const names = (await as(db, INSTR, () => rows("select name from documents order by name"))).map((r) => r.name);
    assert.deepEqual(names, ["Exame"]);
    const admin = (await as(db, ADMIN1, () => rows("select name from documents order by name"))).map((r) => r.name);
    assert.deepEqual(admin, ["Comprovante", "Exame"]);
  });

  test("an instructor cannot attach a receipt, and a receipt cannot point at another client's payment", async () => {
    assert.ok(await as(db, INSTR, () => fails(() => db.exec(`insert into documents (client_id, name, storage_path, mime_type, size_bytes, payment_id) values ('${C_MONTHLY}', 'x', '${C_MONTHLY}/payments/x.pdf', 'application/pdf', 1, '${paymentId}')`))));
    assert.ok(await as(db, ADMIN1, () => fails(() => db.exec(`insert into documents (client_id, name, storage_path, mime_type, size_bytes, payment_id) values ('${C_31}', 'x', '${C_31}/payments/x.pdf', 'application/pdf', 1, '${paymentId}')`))));
  });

  test("receipt files are admin-only in storage; other files follow the client rule", async () => {
    const put = (who: string, path: string) => as(db, who, () => fails(() => db.query("insert into storage.objects (bucket_id, name) values ('client-documents', $1)", [path])));
    assert.equal(await put(ADMIN1, `${C_MONTHLY}/payments/ok.pdf`), null);
    assert.ok(await put(INSTR, `${C_MONTHLY}/payments/no.pdf`));
    assert.equal(await put(INSTR, `${C_MONTHLY}/ok.pdf`), null);
    const seen = async (who: string) => (await as(db, who, () => rows("select name from storage.objects order by name"))).map((r) => r.name);
    assert.deepEqual(await seen(INSTR), [`${C_MONTHLY}/ok.pdf`]);
    assert.equal((await seen(ADMIN1)).length, 2);
  });

  test("deleting a payment deletes its receipt rows, never the client's other documents", async () => {
    await db.exec(`delete from payments where id = '${paymentId}'`);
    const names = (await rows("select name from documents order by name")).map((r) => r.name);
    assert.deepEqual(names, ["Exame"]);
  });
});
