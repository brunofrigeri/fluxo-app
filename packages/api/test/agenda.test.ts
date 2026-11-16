import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAgendaBookings, modalityKeyOf, parseView, rangeFor } from "../src";

test("views fall back when the URL value is unknown", () => {
  assert.equal(parseView("semana", "dia"), "semana");
  assert.equal(parseView("x", "dia"), "dia");
  assert.equal(parseView(undefined, "mes"), "mes");
});

test("week range starts on Monday and spans seven days; month range is whole weeks", () => {
  const week = rangeFor("semana", "2026-10-07");
  assert.equal(week.from, "2026-10-05");
  assert.equal(week.to, "2026-10-11");
  assert.equal(week.days.length, 7);
  assert.equal(week.next, "2026-10-12");
  const month = rangeFor("mes", "2026-10-15");
  assert.equal(month.title, "Outubro de 2026");
  assert.equal(month.days.length % 7, 0);
  assert.equal(month.days[0], "2026-09-28");
});

test("modality key is only accepted for known modalities", () => {
  assert.equal(modalityKeyOf({ key: "pilates" }), "pilates");
  assert.equal(modalityKeyOf([{ key: "acupuncture" }]), "acupuncture");
  assert.equal(modalityKeyOf({ key: "yoga" }), null);
  assert.equal(modalityKeyOf(null), null);
});

/** A minimal stand-in for the query builder: every call returns itself, awaiting yields the rows for that table. */
function stub(tables: Record<string, unknown[]>): SupabaseClient {
  const from = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "gte", "lte", "eq", "in", "order"]) b[m] = () => b;
    b.then = (ok: (v: unknown) => unknown) => ok({ data: tables[table] ?? [], error: null });
    return b;
  };
  return { from } as unknown as SupabaseClient;
}

test("agenda bookings are mapped from rows, with the instructor of the client in that modality", async () => {
  const supabase = stub({
    bookings: [
      { id: "b1", client_id: "c1", date: "2026-10-05", start_time: "07:00:00", status: "PRESENCE_CONFIRMED", replaces_booking_id: null, miss_reason: null, modality_id: "m1", label: null, clients: { name: "Ana" }, modalities: { key: "pilates" } },
    ],
    client_modality_instructors: [{ client_id: "c1", modality_id: "m1", instructor_id: "u1", profiles: { name: "Bia" } }],
  });
  const [b] = await getAgendaBookings(supabase, "2026-10-05", "2026-10-11");
  assert.equal(b.name, "Ana");
  assert.equal(b.hour, 7);
  assert.equal(b.time, "07:00");
  assert.equal(b.modalityKey, "pilates");
  assert.equal(b.instructorName, "Bia");
});
