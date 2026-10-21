import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMigration, boot, migrationFiles } from "./db";

const S = "10000000-0000-0000-0000-000000000001";
const ADMIN = "20000000-0000-0000-0000-000000000001";
const INSTR = "20000000-0000-0000-0000-000000000002";
const C = "30000000-0000-0000-0000-000000000001";

// Data as it exists on a pre-modalities database (migrations up to 0008), then migrate it.
test("0009-0011 migrate existing Pilates data without losing anything", async () => {
  const db = await boot("0008");
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN}', 'a@x.com'), ('${INSTR}', 'i@x.com');
    insert into studios (id, name) values ('${S}', 'Estúdio');
    insert into profiles (id, email, name, role, studio_id) values
      ('${ADMIN}', 'a@x.com', 'Ana', 'admin', '${S}'),
      ('${INSTR}', 'i@x.com', 'Iris', 'instructor', '${S}');
    insert into clients (id, document, name, studio_id, instructor_id) values ('${C}', '111', 'Cli', '${S}', '${INSTR}');
    insert into recurring_slots (client_id, weekday, start_time) values ('${C}', 1, '07:00');
    insert into bookings (id, client_id, date, start_time, status) values
      ('40000000-0000-0000-0000-000000000001', '${C}', '2026-01-05', '07:00', 'PRESENCE_CONFIRMED'),
      ('40000000-0000-0000-0000-000000000002', '${C}', '2026-01-12', '07:00', 'PRESENCE_CONFIRMED');
    insert into evolutions (client_id, booking_id, date, apparatus) values
      ('${C}', '40000000-0000-0000-0000-000000000001', '2026-01-05', '{"reformer":{"strengthening":{"regions":["mmii"],"note":"x"}}}'),
      ('${C}', '40000000-0000-0000-0000-000000000002', '2026-01-12', '{}');
    insert into evaluations (client_id, date, main_complaint, diagnosis, obs) values ('${C}', '2026-01-02', 'Dor lombar', 'Lombalgia', null);
    insert into session_notes (studio_id, date, start_time, note) values ('${S}', '2026-01-05', '07:00', 'nota');
    insert into wait_list (studio_id, name, phone, period) values ('${S}', 'Fila', '11999999999', 'MORNING');
  `);
  for (const f of migrationFiles().filter((f) => f.slice(0, 4) > "0008")) await applyMigration(db, f);

  const pilates = (await db.query<{ id: string }>("select id from modalities where key = 'pilates'")).rows[0].id;
  const one = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows;

  assert.equal((await one(`select count(*)::int n from studio_modalities where studio_id = '${S}' and modality_id = '${pilates}'`))[0].n, 1);
  assert.equal((await one(`select count(*)::int n from user_modalities where modality_id = '${pilates}'`))[0].n, 2);
  assert.deepEqual(await one(`select instructor_id from client_modality_instructors where client_id = '${C}' and modality_id = '${pilates}'`), [{ instructor_id: INSTR }]);
  for (const t of ["recurring_slots", "bookings", "evaluations", "evolutions", "session_notes", "wait_list"]) {
    assert.equal((await one(`select count(*)::int n from ${t} where modality_id is distinct from '${pilates}'`))[0].n, 0, `${t} not all Pilates`);
  }

  const evo = await one("select data, session_number, schema_version, studio_id from evolutions order by date");
  assert.deepEqual(evo[0].data, { apparatus: { reformer: { strengthening: { regions: ["mmii"], note: "x" } } } });
  assert.deepEqual(evo[1].data, {});
  assert.deepEqual(evo.map((e) => e.session_number), [1, 2]);
  assert.equal(evo[0].studio_id, S);

  const ev = await one("select data, studio_id from evaluations");
  assert.deepEqual(ev[0].data, { main_complaint: "Dor lombar", diagnosis: "Lombalgia" });
  assert.equal(ev[0].studio_id, S);

  // Old columns are still there, untouched.
  assert.equal((await one("select main_complaint from evaluations"))[0].main_complaint, "Dor lombar");
});
