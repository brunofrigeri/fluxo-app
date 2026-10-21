import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { PGlite } from "@electric-sql/pglite";
import { as, boot, fails } from "./db";

const id = (a: number, b: number) => `${a}0000000-0000-0000-0000-${String(b).padStart(12, "0")}`;
const S1 = id(1, 1), S2 = id(1, 2);
const ADMIN1 = id(2, 1), ADMIN2 = id(2, 2), INSTRUCTOR = id(2, 3);
const C1 = id(3, 1), C2 = id(3, 2), C3 = id(3, 3), C_NOT_ENROLLED = id(3, 4), C_OTHER_STUDIO = id(3, 5);

// 2026-03-02 is a Monday (weekday 1).
const MONDAY = "2026-03-02";
const NEXT_MONDAY = "2026-03-09";
const TUESDAY = "2026-03-03";

let db: PGlite;
let PIL: string, ACU: string;

const rows = async (sql: string, params?: unknown[]) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const one = async (sql: string, params?: unknown[]) => (await rows(sql, params))[0];
const count = async (sql: string) => Number((await one(sql)).n);
const book = async (client: string, date: string, number: string, studio = S1, modality = PIL, start = "07:00") =>
  (await one("select wellhub_book($1, $2, $3, $4, $5, $6) r", [studio, client, modality, date, start, number])).r as string;

before(async () => {
  db = await boot();
  PIL = (await one("select id from modalities where key = 'pilates'")).id as string;
  ACU = (await one("select id from modalities where key = 'acupuncture'")).id as string;
  await db.exec(`
    insert into auth.users (id, email) values ('${ADMIN1}', 'a1@x'), ('${ADMIN2}', 'a2@x'), ('${INSTRUCTOR}', 'i@x');
    insert into studios (id, name) values ('${S1}', 'S1'), ('${S2}', 'S2');
    insert into profiles (id, email, name, role, studio_id) values
      ('${ADMIN1}', 'a1@x', 'Admin1', 'admin', '${S1}'),
      ('${ADMIN2}', 'a2@x', 'Admin2', 'admin', '${S2}'),
      ('${INSTRUCTOR}', 'i@x', 'Instrutor', 'instructor', '${S1}');
    insert into studio_modalities values ('${S1}', '${PIL}'), ('${S2}', '${PIL}');
    insert into clients (id, document, name, studio_id) values
      ('${C1}', '1', 'Cliente 1', '${S1}'), ('${C2}', '2', 'Cliente 2', '${S1}'), ('${C3}', '3', 'Cliente 3', '${S1}'),
      ('${C_NOT_ENROLLED}', '4', 'Sem modalidade', '${S1}'), ('${C_OTHER_STUDIO}', '5', 'Outro estúdio', '${S2}');
    insert into client_modality_instructors values
      ('${C1}', '${PIL}', null), ('${C2}', '${PIL}', null), ('${C3}', '${PIL}', null), ('${C_OTHER_STUDIO}', '${PIL}', null);
  `);
});

describe("class slots (weekly capacity)", () => {
  test("an admin manages their studio's slots; an instructor reads them but cannot write", async () => {
    await as(db, ADMIN1, async () => {
      await db.query(
        "insert into class_slots (modality_id, weekday, start_time, duration_minutes, capacity, wellhub_enabled) values ($1, 1, '07:00', 50, 2, true)",
        [PIL],
      );
    });
    await as(db, INSTRUCTOR, async () => {
      assert.equal(await count("select count(*) n from class_slots"), 1);
      const err = await fails(() => db.query("insert into class_slots (modality_id, weekday, start_time, capacity) values ($1, 2, '07:00', 3)", [PIL]));
      assert.ok(err, "an instructor must not create slots");
      await db.exec("update class_slots set capacity = 99");
    });
    assert.equal(await count("select count(*) n from class_slots where capacity = 99"), 0, "an instructor must not change capacity");
  });

  test("another studio cannot see or touch them", async () => {
    await as(db, ADMIN2, async () => {
      assert.equal(await count("select count(*) n from class_slots"), 0);
      const err = await fails(() =>
        db.query("insert into class_slots (studio_id, modality_id, weekday, start_time, capacity) values ($1, $2, 1, '08:00', 5)", [S1, PIL]),
      );
      assert.ok(err, "cannot insert into another studio");
    });
  });

  test("the modality must be enabled in the studio", async () => {
    const err = await fails(() =>
      as(db, ADMIN1, () => db.query("insert into class_slots (modality_id, weekday, start_time, capacity) values ($1, 3, '07:00', 3)", [ACU])),
    );
    assert.match(err ?? "", /modalidade/i);
  });

  test("a time is unique per modality and weekday; capacity must be positive; Wellhub needs 30+ minutes", async () => {
    assert.ok(await fails(() => as(db, ADMIN1, () => db.query("insert into class_slots (modality_id, weekday, start_time, capacity) values ($1, 1, '07:00', 4)", [PIL]))));
    assert.ok(await fails(() => as(db, ADMIN1, () => db.query("insert into class_slots (modality_id, weekday, start_time, capacity) values ($1, 3, '09:00', 0)", [PIL]))));
    assert.ok(await fails(() =>
      as(db, ADMIN1, () => db.query("insert into class_slots (modality_id, weekday, start_time, duration_minutes, capacity, wellhub_enabled) values ($1, 3, '09:00', 20, 3, true)", [PIL])),
    ));
    // The same short class is fine while it is not published.
    await as(db, ADMIN1, () =>
      db.query("insert into class_slots (modality_id, weekday, start_time, duration_minutes, capacity) values ($1, 3, '09:00', 20, 3)", [PIL]),
    );
  });
});

describe("connection", () => {
  let code: string;

  test("the admin starts a connection and gets a code; instructors and other studios see nothing", async () => {
    await as(db, ADMIN1, async () => {
      await db.exec("insert into wellhub_connections default values");
      const r = await one("select connection_code, status, gym_id from wellhub_connections");
      code = r.connection_code as string;
      assert.match(code, /^[0-9A-F]{12}$/);
      assert.equal(r.status, "awaiting");
      assert.equal(r.gym_id, null);
    });
    await as(db, INSTRUCTOR, async () => assert.equal(await count("select count(*) n from wellhub_connections"), 0));
    await as(db, ADMIN2, async () => assert.equal(await count("select count(*) n from wellhub_connections"), 0));
  });

  test("the browser cannot claim a gym, change the code, or mark itself connected", async () => {
    await as(db, ADMIN1, async () => {
      assert.ok(await fails(() => db.exec("update wellhub_connections set gym_id = 123")));
      assert.ok(await fails(() => db.exec("update wellhub_connections set status = 'connected'")));
      assert.ok(await fails(() => db.exec("update wellhub_connections set connection_code = 'AAAAAAAAAAAA'")));
      assert.ok(await fails(() => db.exec("insert into wellhub_connections (studio_id, status) values ('" + S2 + "', 'awaiting')")), "not for another studio");
    });
    assert.equal((await one("select status from wellhub_connections")).status, "awaiting");
  });

  test("the admin edits the booking rules, within Wellhub's limits", async () => {
    await as(db, ADMIN1, async () => {
      await db.exec("update wellhub_connections set opens_days_before = 5, closes_hours_before = 1, cancel_hours_before = 4");
      assert.ok(await fails(() => db.exec("update wellhub_connections set cancel_hours_before = 30")), "Wellhub caps cancellation at 24h");
    });
    assert.equal((await one("select opens_days_before d from wellhub_connections")).d, 5);
  });

  test("the secret table cannot be read or written from the browser", async () => {
    await db.query("insert into wellhub_secrets (studio_id, webhook_secret) values ($1, $2)", [S1, "a-long-enough-secret-value"]);
    await as(db, ADMIN1, async () => {
      assert.equal(await count("select count(*) n from wellhub_secrets"), 0);
      assert.ok(await fails(() => db.query("insert into wellhub_secrets (studio_id, webhook_secret) values ($1, 'another-long-enough-secret')", [S2])));
    });
    assert.ok(await fails(() => db.query("update wellhub_secrets set webhook_secret = 'short'")), "too short");
  });

  test("linking: a wrong code matches nobody; the right one connects the studio; a stranger cannot take it over", async () => {
    assert.equal((await one("select wellhub_link_gym('NOPE', 111, 'Academia', null) r")).r, null);
    const r = await one("select wellhub_link_gym($1, 111, 'Studio S1', $2) r", [code.toLowerCase(), "2cff9739-5cd2-4299-8753-ba56aafb9c92"]);
    assert.equal(r.r, S1);
    const c = await one("select status, gym_id, gym_name from wellhub_connections");
    assert.deepEqual([c.status, String(c.gym_id), c.gym_name], ["connected", "111", "Studio S1"]);
    // A second gym quoting the same code is ignored: the studio is no longer waiting.
    assert.equal((await one("select wellhub_link_gym($1, 222, 'Impostor', null) r", [code])).r, null);
    assert.equal(String((await one("select gym_id from wellhub_connections")).gym_id), "111");
    // The same gym asking again (a retried webhook) is fine.
    assert.equal((await one("select wellhub_link_gym($1, 111, 'Studio S1', null) r", [code])).r, S1);
  });

  test("once connected, the admin can switch it off and on, but not skip the confirmation", async () => {
    await as(db, ADMIN1, async () => {
      await db.exec("update wellhub_connections set status = 'disabled'");
      await db.exec("update wellhub_connections set status = 'connected'");
      assert.ok(await fails(() => db.exec("update wellhub_connections set status = 'awaiting'")));
    });
  });

  test("a connected status needs a gym", async () => {
    assert.ok(await fails(() => db.query("insert into wellhub_connections (studio_id, status) values ($1, 'connected')", [S2])));
  });
});

describe("bookings from Wellhub", () => {
  test("the functions refuse to run for a signed-in user", async () => {
    await as(db, ADMIN1, async () => {
      assert.match((await fails(() => db.query("select wellhub_book($1, $2, $3, $4, '07:00', 'BK_X')", [S1, C1, PIL, MONDAY]))) ?? "", /servidor/);
      assert.match((await fails(() => db.query("select wellhub_cancel($1, 'BK_X', false)", [S1]))) ?? "", /servidor/);
      assert.match((await fails(() => db.query("select wellhub_link_gym('X', 1, 'x', null)"))) ?? "", /servidor/);
    });
  });

  test("a free place is reserved, and the same booking number twice is idempotent", async () => {
    assert.equal(await book(C1, MONDAY, "BK_1"), "RESERVED");
    assert.equal(await book(C1, MONDAY, "BK_1"), "RESERVED");
    assert.equal(await count(`select count(*) n from bookings where wellhub_booking_number = 'BK_1'`), 1);
    assert.equal((await one("select session_occupancy($1, $2, $3, '07:00') n", [S1, PIL, MONDAY])).n, 1);
  });

  test("the same person cannot take two places in one session", async () => {
    assert.equal(await book(C1, MONDAY, "BK_1B"), "USER_IS_ALREADY_BOOKED");
  });

  test("the last place goes to one booking, then the class is full", async () => {
    assert.equal(await book(C2, MONDAY, "BK_2"), "RESERVED"); // capacity is 2
    assert.equal(await book(C3, MONDAY, "BK_3"), "CLASS_IS_FULL");
    assert.equal(await count(`select count(*) n from bookings where date = '${MONDAY}' and start_time = '07:00'`), 2);
  });

  test("manual bookings are not limited, but they do count against Wellhub's places", async () => {
    await db.query("insert into bookings (client_id, modality_id, date, start_time) values ($1, $2, $3, '07:00')", [C3, PIL, MONDAY]);
    assert.equal(await count(`select count(*) n from bookings where date = '${MONDAY}' and start_time = '07:00'`), 3, "the studio may overbook by hand");
    assert.equal(await book(C_OTHER_STUDIO, NEXT_MONDAY, "BK_X", S1), "USER_DOES_NOT_EXIST", "a client of another studio");
  });

  test("rejections use Wellhub's reason categories", async () => {
    assert.equal(await book(C1, TUESDAY, "BK_T", S1, PIL, "07:00"), "CLASS_NOT_FOUND", "no slot on that weekday");
    assert.equal(await book(C1, MONDAY, "BK_Z", S1, PIL, "11:00"), "CLASS_NOT_FOUND", "no slot at that time");
    assert.equal(await book(C1, MONDAY, "BK_A", S1, ACU), "CLASS_NOT_FOUND", "no slot in that modality");
    await db.exec(`update class_slots set wellhub_enabled = false where start_time = '07:00' and weekday = 1`);
    assert.equal(await book(C1, NEXT_MONDAY, "BK_N"), "CLASS_NOT_FOUND", "not published to Wellhub");
    await db.exec(`update class_slots set wellhub_enabled = true where start_time = '07:00' and weekday = 1`);
    assert.equal(await book(C_NOT_ENROLLED, NEXT_MONDAY, "BK_E"), "USER_PROFILE_CMS", "not enrolled in the modality");
    await db.exec(`update clients set active = false where id = '${C3}'`);
    assert.equal(await book(C3, NEXT_MONDAY, "BK_I"), "USER_DOES_NOT_EXIST", "archived client");
    await db.exec(`update clients set active = true where id = '${C3}'`);
  });

  test("nothing is booked while the connection is off", async () => {
    await db.exec(`update wellhub_connections set status = 'disabled' where studio_id = '${S1}'`);
    assert.equal(await book(C1, NEXT_MONDAY, "BK_D"), "GENERAL_ERROR");
    await db.exec(`update wellhub_connections set status = 'connected' where studio_id = '${S1}'`);
    assert.equal(await book(C1, NEXT_MONDAY, "BK_D"), "RESERVED");
  });
});

describe("cancellations from Wellhub", () => {
  test("a free cancellation removes the booking and frees the place", async () => {
    const before = (await one("select session_occupancy($1, $2, $3, '07:00') n", [S1, PIL, NEXT_MONDAY])).n;
    assert.equal((await one("select wellhub_cancel($1, 'BK_D', false) r", [S1])).r, true);
    assert.equal(await count("select count(*) n from bookings where wellhub_booking_number = 'BK_D'"), 0);
    assert.equal((await one("select session_occupancy($1, $2, $3, '07:00') n", [S1, PIL, NEXT_MONDAY])).n, Number(before) - 1);
    assert.equal((await one("select wellhub_cancel($1, 'BK_D', false) r", [S1])).r, false, "a repeated cancellation is harmless");
  });

  test("a late cancellation keeps the booking as a justified miss and frees the place", async () => {
    assert.equal((await one("select wellhub_cancel($1, 'BK_2', true) r", [S1])).r, true);
    const b = await one("select status, miss_reason from bookings where wellhub_booking_number = 'BK_2'");
    assert.equal(b.status, "JUSTIFIED_MISS");
    assert.match(b.miss_reason as string, /tardio/i);
    // BK_1 and the manual booking still hold places (capacity 2), so the class stays full...
    assert.equal((await one("select session_occupancy($1, $2, $3, '07:00') n", [S1, PIL, MONDAY])).n, 2);
    assert.equal(await book(C3, MONDAY, "BK_2B"), "USER_IS_ALREADY_BOOKED", "C3 holds the manual booking");
    // ...until the studio frees the manual one: then the place BK_2 gave up is really available.
    await db.query("delete from bookings where client_id = $1 and date = $2 and wellhub_booking_number is null", [C3, MONDAY]);
    assert.equal(await book(C3, MONDAY, "BK_2B"), "RESERVED");
  });

  test("a session that was already marked is left alone, and another studio cannot cancel it", async () => {
    await db.exec("update bookings set status = 'PRESENCE_CONFIRMED' where wellhub_booking_number = 'BK_1'");
    assert.equal((await one("select wellhub_cancel($1, 'BK_1', false) r", [S1])).r, false);
    assert.equal((await one("select wellhub_cancel($1, 'BK_2B', false) r", [S2])).r, false, "wrong studio");
    assert.equal(await count("select count(*) n from bookings where wellhub_booking_number in ('BK_1', 'BK_2B')"), 2);
  });
});
