import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { as, boot, fails } from "./db";

const id = (a: number, b: number) => `${a}0000000-0000-0000-0000-${String(b).padStart(12, "0")}`;
const S1 = id(1, 1), S2 = id(1, 2);
const ADMIN1 = id(2, 1), ADMIN2 = id(2, 2), PILATES_I = id(2, 3), ACU_I = id(2, 4), BOTH_I = id(2, 5);
const C1 = id(3, 1), C2 = id(3, 2), C_OTHER_STUDIO = id(3, 3);

let db: PGlite;
let PIL: string, ACU: string;

const rows = async (sql: string, params?: unknown[]) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const count = async (sql: string) => Number((await rows(sql))[0].n);

before(async () => {
  db = await boot();
  PIL = (await rows("select id from modalities where key = 'pilates'"))[0].id as string;
  ACU = (await rows("select id from modalities where key = 'acupuncture'"))[0].id as string;
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ADMIN1}', 'a1@x'), ('${ADMIN2}', 'a2@x'), ('${PILATES_I}', 'p@x'), ('${ACU_I}', 'c@x'), ('${BOTH_I}', 'b@x');
    insert into studios (id, name) values ('${S1}', 'S1'), ('${S2}', 'S2');
    insert into profiles (id, email, name, role, studio_id) values
      ('${ADMIN1}', 'a1@x', 'Admin1', 'admin', '${S1}'),
      ('${ADMIN2}', 'a2@x', 'Admin2', 'admin', '${S2}'),
      ('${PILATES_I}', 'p@x', 'Pilates', 'instructor', '${S1}'),
      ('${ACU_I}', 'c@x', 'Acu', 'instructor', '${S1}'),
      ('${BOTH_I}', 'b@x', 'Both', 'instructor', '${S1}');
    insert into studio_modalities values ('${S1}', '${PIL}'), ('${S1}', '${ACU}'), ('${S2}', '${PIL}');
    insert into user_modalities values ('${PILATES_I}', '${PIL}'), ('${ACU_I}', '${ACU}'), ('${BOTH_I}', '${PIL}'), ('${BOTH_I}', '${ACU}'); -- admins teach every studio modality by default (0012)
    insert into clients (id, document, name, studio_id) values
      ('${C1}', '1', 'Cliente 1', '${S1}'), ('${C2}', '2', 'Cliente 2', '${S1}'), ('${C_OTHER_STUDIO}', '3', 'Outro', '${S2}');
    -- C1: Pilates with PILATES_I, Acupuncture with ACU_I. C2: Pilates with BOTH_I only.
    insert into client_modality_instructors values
      ('${C1}', '${PIL}', '${PILATES_I}'), ('${C1}', '${ACU}', '${ACU_I}'), ('${C2}', '${PIL}', '${BOTH_I}'), ('${C_OTHER_STUDIO}', '${PIL}', null);
    insert into recurring_slots (id, client_id, modality_id, weekday, start_time) values
      ('${id(4, 1)}', '${C1}', '${PIL}', 1, '07:00'), ('${id(4, 2)}', '${C1}', '${ACU}', 2, '08:00');
    insert into bookings (id, client_id, modality_id, date, start_time, status, miss_reason) values
      ('${id(5, 1)}', '${C1}', '${PIL}', '2026-03-02', '07:00', 'PRESENCE_CONFIRMED', null),
      ('${id(5, 2)}', '${C1}', '${ACU}', '2026-03-03', '08:00', 'PRESENCE_CONFIRMED', null),
      ('${id(5, 3)}', '${C1}', '${PIL}', '2026-03-09', '07:00', 'JUSTIFIED_MISS', 'viagem');
    insert into evaluations (client_id, modality_id, date) values ('${C1}', '${PIL}', '2026-03-01'), ('${C1}', '${ACU}', '2026-03-01');
    insert into evolutions (client_id, modality_id, date, booking_id, session_number) values
      ('${C1}', '${PIL}', '2026-03-02', '${id(5, 1)}', 1), ('${C1}', '${ACU}', '2026-03-03', '${id(5, 2)}', 1);
    insert into documents (client_id, name, storage_path, mime_type, size_bytes) values ('${C1}', 'exame', '${C1}/a.pdf', 'application/pdf', 10);
  `);
  await db.exec(`insert into bookings (id, client_id, label, date, start_time) values ('${id(5, 4)}', '${C1}', 'Aula experimental', '2026-03-04', '09:00')`);
});

describe("instructor scoping by modality", () => {
  test("a Pilates instructor sees the client, the Pilates rows and none of the Acupuncture ones", async () => {
    await as(db, PILATES_I, async () => {
      assert.equal(await count("select count(*) n from clients where id = '" + C1 + "'"), 1);
      assert.equal(await count("select count(*) n from clients"), 1, "must not see C2 or other studios");
      assert.equal(await count(`select count(*) n from recurring_slots where modality_id = '${ACU}'`), 0);
      assert.equal(await count(`select count(*) n from recurring_slots where modality_id = '${PIL}'`), 1);
      assert.equal(await count(`select count(*) n from bookings where modality_id = '${ACU}'`), 0);
      assert.equal(await count(`select count(*) n from evaluations where modality_id = '${ACU}'`), 0);
      assert.equal(await count(`select count(*) n from evolutions where modality_id = '${ACU}'`), 0);
      assert.equal(await count(`select count(*) n from evolutions where modality_id = '${PIL}'`), 1);
      assert.equal(await count("select count(*) n from client_modality_instructors"), 1);
    });
  });

  test("an instructor responsible in both modalities sees both; documents are visible from any modality", async () => {
    await as(db, ACU_I, async () => {
      assert.equal(await count("select count(*) n from documents"), 1, "documents have no modality");
      assert.equal(await count("select count(*) n from evolutions"), 1);
    });
    await db.exec(`update client_modality_instructors set instructor_id = '${BOTH_I}' where client_id = '${C1}'`);
    await as(db, BOTH_I, async () => {
      assert.equal(await count("select count(*) n from evolutions where client_id = '" + C1 + "'"), 2);
      assert.equal(await count("select count(*) n from clients"), 2);
    });
    await db.exec(`update client_modality_instructors set instructor_id = '${PILATES_I}' where client_id = '${C1}' and modality_id = '${PIL}'; update client_modality_instructors set instructor_id = '${ACU_I}' where client_id = '${C1}' and modality_id = '${ACU}'`);
  });

  test("labelled bookings are visible to any instructor of the client", async () => {
    await as(db, ACU_I, async () => assert.equal(await count("select count(*) n from bookings where label is not null"), 1));
    await as(db, BOTH_I, async () => assert.equal(await count("select count(*) n from bookings where label is not null"), 0, "BOTH_I has no access to C1 here"));
  });

  test("an instructor cannot write rows of a modality they do not handle", async () => {
    await as(db, PILATES_I, async () => {
      const err = await fails(() => db.query("insert into evaluations (client_id, modality_id, date) values ($1, $2, '2026-03-05')", [C1, ACU]));
      assert.match(err ?? "", /row-level security|não está inscrito/);
      await db.query("insert into evaluations (client_id, modality_id, date) values ($1, $2, '2026-03-05')", [C1, PIL]);
    });
    await db.exec("delete from evaluations where date = '2026-03-05'");
  });

  test("admins see their whole studio and nothing of another studio", async () => {
    await as(db, ADMIN1, async () => {
      assert.equal(await count("select count(*) n from clients"), 2);
      assert.equal(await count("select count(*) n from bookings"), 4);
      assert.equal(await count("select count(*) n from evolutions"), 2);
    });
    await as(db, ADMIN2, async () => {
      assert.equal(await count("select count(*) n from clients"), 1);
      assert.equal(await count("select count(*) n from bookings"), 0);
      assert.equal(await count("select count(*) n from evaluations"), 0);
      const err = await fails(() => db.query("insert into bookings (client_id, modality_id, date, start_time) values ($1, $2, '2026-04-01', '10:00')", [C1, PIL]));
      assert.ok(err, "admin of studio 2 must not write into studio 1");
      assert.equal(await count("select count(*) n from studio_modalities"), 1);
    });
  });

  test("storage objects follow the same client access", async () => {
    await db.exec("insert into storage.buckets (id, name) values ('client-documents', 'client-documents') on conflict do nothing");
    await as(db, PILATES_I, async () => {
      await db.query("insert into storage.objects (bucket_id, name) values ('client-documents', $1)", [`${C1}/f.pdf`]);
      const err = await fails(() => db.query("insert into storage.objects (bucket_id, name) values ('client-documents', $1)", [`${C2}/f.pdf`]));
      assert.match(err ?? "", /row-level security/);
    });
  });
});

describe("enrollment and assignment", () => {
  test("a new client can be created by an instructor and enrolled as themselves, nobody else can take it over", async () => {
    const NEW = id(3, 9);
    await as(db, PILATES_I, async () => {
      const r = await db.query("insert into clients (id, document, name, studio_id) values ($1, '9', 'Novo', $2) returning id", [NEW, S1]);
      assert.equal(r.rows.length, 1, "creator can see the unassigned client");
      await db.query("insert into client_modality_instructors (client_id, modality_id, instructor_id) values ($1, $2, $3)", [NEW, PIL, PILATES_I]);
    });
    await as(db, BOTH_I, async () => {
      assert.equal(await count(`select count(*) n from clients where id = '${NEW}'`), 0);
      const err = await fails(() => db.query("insert into client_modality_instructors (client_id, modality_id, instructor_id) values ($1, $2, $3)", [NEW, ACU, BOTH_I]));
      assert.match(err ?? "", /row-level security/, "an instructor cannot add themselves to someone else's client");
    });
    await as(db, PILATES_I, async () => {
      const err = await fails(() => db.query("insert into client_modality_instructors (client_id, modality_id, instructor_id) values ($1, $2, $3)", [NEW, ACU, PILATES_I]));
      assert.match(err ?? "", /não ensina esta modalidade/);
    });
  });

  test("a client cannot be created in another studio or in somebody else's name", async () => {
    await as(db, PILATES_I, async () => {
      assert.match((await fails(() => db.query("insert into clients (document, name, studio_id) values ('x1', 'X', $1)", [S2]))) ?? "", /row-level security/);
      assert.match((await fails(() => db.query("insert into clients (document, name, studio_id, created_by) values ('x2', 'X', $1, $2)", [S1, BOTH_I]))) ?? "", /row-level security/);
    });
  });

  test("only admins reassign or unenroll", async () => {
    await as(db, PILATES_I, async () => {
      await db.query("update client_modality_instructors set instructor_id = $1 where client_id = $2 and modality_id = $3", [BOTH_I, C1, PIL]);
      const stillMine = await count(`select count(*) n from client_modality_instructors where client_id = '${C1}' and instructor_id = '${BOTH_I}'`);
      assert.equal(stillMine, 0, "update must affect no row for an instructor");
    });
  });

  test("the responsible instructor must teach the modality and belong to the studio", async () => {
    await as(db, ADMIN1, async () => {
      const wrongModality = await fails(() => db.query("update client_modality_instructors set instructor_id = $1 where client_id = $2 and modality_id = $3", [PILATES_I, C1, ACU]));
      assert.match(wrongModality ?? "", /não ensina esta modalidade/);
      const otherStudio = await fails(() => db.query("update client_modality_instructors set instructor_id = $1 where client_id = $2 and modality_id = $3", [ADMIN2, C1, PIL]));
      assert.match(otherStudio ?? "", /não pertence a este estúdio|não ensina/);
    });
  });

  test("a client can only be scheduled and recorded in modalities they are enrolled in", async () => {
    for (const sql of [
      `insert into recurring_slots (client_id, modality_id, weekday, start_time) values ('${C2}', '${ACU}', 3, '10:00')`,
      `insert into bookings (client_id, modality_id, date, start_time) values ('${C2}', '${ACU}', '2026-04-01', '10:00')`,
      `insert into evaluations (client_id, modality_id, date) values ('${C2}', '${ACU}', '2026-04-01')`,
      `insert into evolutions (client_id, modality_id, date, session_number) values ('${C2}', '${ACU}', '2026-04-01', 1)`,
    ]) {
      assert.match((await fails(() => db.exec(sql))) ?? "", /não está inscrito nesta modalidade/, sql);
    }
  });

  test("a modality that the studio does not offer cannot be used", async () => {
    const err = await fails(() => db.exec(`insert into client_modality_instructors (client_id, modality_id) values ('${C_OTHER_STUDIO}', '${ACU}')`));
    assert.match(err ?? "", /não está ativa/);
    assert.match((await fails(() => db.exec(`insert into wait_list (studio_id, modality_id, name, phone, period) values ('${S2}', '${ACU}', 'x', '1', 'NIGHT')`))) ?? "", /não está ativa/);
    assert.match((await fails(() => db.exec(`insert into session_notes (studio_id, modality_id, date, start_time, note) values ('${S2}', '${ACU}', '2026-04-01', '07:00', 'n')`))) ?? "", /não está ativa/);
    assert.match((await fails(() => db.exec(`insert into user_modalities values ('${ADMIN2}', '${ACU}')`))) ?? "", /não está ativa/);
  });

  test("a modality with history cannot be removed from a client; one without can", async () => {
    assert.match((await fails(() => db.exec(`delete from client_modality_instructors where client_id = '${C1}' and modality_id = '${ACU}'`))) ?? "", /não pode ser removida/);
    await db.exec(`insert into client_modality_instructors values ('${C2}', '${ACU}', null)`);
    await db.exec(`delete from client_modality_instructors where client_id = '${C2}' and modality_id = '${ACU}'`);
  });

  test("deleting a client (data lifecycle request) is not blocked by its history", async () => {
    const TMP = id(3, 8);
    await db.exec(`
      insert into clients (id, document, name, studio_id) values ('${TMP}', 'tmp', 'Tmp', '${S1}');
      insert into client_modality_instructors values ('${TMP}', '${PIL}', null);
      insert into bookings (client_id, modality_id, date, start_time) values ('${TMP}', '${PIL}', '2026-05-01', '07:00');
      delete from clients where id = '${TMP}';
    `);
    assert.equal(await count(`select count(*) n from bookings where client_id = '${TMP}'`), 0);
  });

  test("a studio cannot switch off a modality while clients are enrolled; users stop teaching it when it goes", async () => {
    assert.match((await fails(() => db.exec(`delete from studio_modalities where studio_id = '${S1}' and modality_id = '${ACU}'`))) ?? "", /Há clientes inscritos/);
    await db.exec(`insert into studio_modalities values ('${S2}', '${ACU}')`);
    await db.exec(`delete from studio_modalities where studio_id = '${S2}' and modality_id = '${ACU}'`);
    assert.equal(await count(`select count(*) n from user_modalities where user_id = '${ADMIN2}' and modality_id = '${ACU}'`), 0);
  });

  test("when a user stops teaching a modality they are released from their clients", async () => {
    await db.exec(`delete from user_modalities where user_id = '${ACU_I}' and modality_id = '${ACU}'`);
    assert.equal((await rows(`select instructor_id from client_modality_instructors where client_id = '${C1}' and modality_id = '${ACU}'`))[0].instructor_id, null);
    await as(db, ACU_I, async () => assert.equal(await count("select count(*) n from clients"), 0));
    await db.exec(`insert into user_modalities values ('${ACU_I}', '${ACU}'); update client_modality_instructors set instructor_id = '${ACU_I}' where client_id = '${C1}' and modality_id = '${ACU}'`);
  });
});

describe("bookings and evolutions", () => {
  test("generated bookings inherit the modality of their slot", async () => {
    await db.exec("select generate_bookings(8)");
    assert.equal(await count(`select count(*) n from bookings where recurring_slot_id = '${id(4, 2)}' and modality_id is distinct from '${ACU}'`), 0);
    assert.ok(await count(`select count(*) n from bookings where recurring_slot_id = '${id(4, 2)}'`) > 0);
    await db.exec("delete from bookings where recurring_slot_id is not null and status is null");
  });

  test("an evolution must use a session of its own modality; labelled bookings take no evolution", async () => {
    assert.match((await fails(() => db.exec(`insert into evolutions (client_id, modality_id, date, session_number, booking_id) values ('${C1}', '${ACU}', '2026-03-02', 2, '${id(5, 1)}')`))) ?? "", /outra modalidade/);
    assert.match((await fails(() => db.exec(`update bookings set status = 'PRESENCE_CONFIRMED' where id = '${id(5, 4)}'; insert into evolutions (client_id, modality_id, date, session_number, booking_id) values ('${C1}', '${ACU}', '2026-03-04', 2, '${id(5, 4)}')`))) ?? "", /outra modalidade/);
  });

  test("a replacement must be of the same modality as the missed session", async () => {
    assert.match((await fails(() => db.exec(`insert into bookings (client_id, modality_id, date, start_time, status, replaces_booking_id) values ('${C1}', '${ACU}', '2026-03-16', '08:00', 'REPLACEMENT', '${id(5, 3)}')`))) ?? "", /mesma modalidade/);
    await db.exec(`insert into bookings (client_id, modality_id, date, start_time, status, replaces_booking_id) values ('${C1}', '${PIL}', '2026-03-16', '07:00', 'REPLACEMENT', '${id(5, 3)}')`);
  });

  test("a booking is a modality session or a labelled entry, never both or neither", async () => {
    assert.ok(await fails(() => db.exec(`insert into bookings (client_id, date, start_time) values ('${C1}', '2026-06-01', '10:00')`)));
    assert.ok(await fails(() => db.exec(`insert into bookings (client_id, modality_id, label, date, start_time) values ('${C1}', '${PIL}', 'x', '2026-06-01', '10:00')`)));
    assert.ok(await fails(() => db.exec(`insert into bookings (client_id, label, date, start_time) values ('${C1}', '   ', '2026-06-01', '10:00')`)));
  });

  test("class notes are per modality", async () => {
    await db.exec(`insert into session_notes (studio_id, modality_id, date, start_time, note) values ('${S1}', '${PIL}', '2026-03-02', '07:00', 'a'), ('${S1}', '${ACU}', '2026-03-02', '07:00', 'b')`);
    assert.equal(await count(`select count(*) n from session_notes where studio_id = '${S1}'`), 2);
  });
});

describe("generic evaluation and evolution records", () => {
  test("studio and author come from the database, not from the caller", async () => {
    await as(db, PILATES_I, async () => {
      await db.query("insert into evaluations (client_id, modality_id, date, studio_id, created_by, data) values ($1, $2, '2026-03-10', $3, $4, $5)", [C1, PIL, S2, ADMIN2, JSON.stringify({ obs: "x" })]);
    });
    const r = (await rows("select studio_id, created_by from evaluations where date = '2026-03-10'"))[0];
    assert.equal(r.studio_id, S1);
    assert.equal(r.created_by, PILATES_I);
  });

  test("data must be a json object", async () => {
    assert.ok(await fails(() => db.exec(`insert into evaluations (client_id, modality_id, date, data) values ('${C1}', '${PIL}', '2026-03-11', '[]')`)));
  });
});

describe("signup provisioning", () => {
  test("a new founder can create a studio, enable modalities and teach them, but only for their own studio", async () => {
    const NEW_USER = id(2, 9), NEW_STUDIO = id(1, 9);
    await db.exec(`insert into auth.users (id, email) values ('${NEW_USER}', 'new@x')`);
    await as(db, NEW_USER, async () => {
      // The same sequence as provisionStudio in src/lib/admin.ts.
      await db.query("insert into studios (id, name) values ($1, 'Novo')", [NEW_STUDIO]);
      await db.query("insert into profiles (id, email, name, role, studio_id) values ($1, 'new@x', 'Novo', 'admin', $2)", [NEW_USER, NEW_STUDIO]);
      await db.query("insert into studio_modalities (studio_id, modality_id) values ($1, $2), ($1, $3)", [NEW_STUDIO, PIL, ACU]);
      // The founder is an admin, so they already teach both (0012).
      assert.equal(await count(`select count(*) n from user_modalities where user_id = '${NEW_USER}'`), 2);
      assert.equal(await count("select count(*) n from studio_modalities"), 2);
      // Not into somebody else's studio.
      assert.ok(await fails(() => db.query("insert into studio_modalities (studio_id, modality_id) values ($1, $2)", [S2, ACU])));
    });
  });

  test("nobody can write the modalities seed table", async () => {
    await as(db, ADMIN1, async () => {
      assert.ok(await fails(() => db.exec("insert into modalities (key, name_pt) values ('yoga', 'Yoga')")));
      assert.ok(await fails(() => db.exec("update modalities set name_pt = 'x'")) || (await count("select count(*) n from modalities where name_pt = 'x'")) === 0);
    });
  });
});

describe("admins are instructors by default", () => {
  test("a new admin teaches every studio modality, and a new studio modality is added to every admin", async () => {
    const A = id(2, 20), I = id(2, 21), ST = id(1, 20);
    await db.exec(`
      insert into auth.users (id, email) values ('${A}', 'a@y'), ('${I}', 'i@y');
      insert into studios (id, name) values ('${ST}', 'S');
      insert into profiles (id, email, name, role, studio_id) values ('${A}', 'a@y', 'A', 'admin', '${ST}');
      insert into studio_modalities values ('${ST}', '${PIL}');
    `);
    assert.equal(await count(`select count(*) n from user_modalities where user_id = '${A}'`), 1);
    await db.exec(`insert into studio_modalities values ('${ST}', '${ACU}')`);
    assert.equal(await count(`select count(*) n from user_modalities where user_id = '${A}'`), 2);
    // An instructor does not get them; becoming an admin does.
    await db.exec(`insert into profiles (id, email, name, role, studio_id) values ('${I}', 'i@y', 'I', 'instructor', '${ST}')`);
    assert.equal(await count(`select count(*) n from user_modalities where user_id = '${I}'`), 0);
    await db.exec(`update profiles set role = 'admin' where id = '${I}'`);
    assert.equal(await count(`select count(*) n from user_modalities where user_id = '${I}'`), 2);
    // Still editable: an admin can stop teaching one.
    await db.exec(`delete from user_modalities where user_id = '${I}' and modality_id = '${ACU}'`);
    assert.equal(await count(`select count(*) n from user_modalities where user_id = '${I}'`), 1);
  });
});
