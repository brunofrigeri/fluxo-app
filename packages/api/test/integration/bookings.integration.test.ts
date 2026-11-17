import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { createBooking, deleteBooking, getAgendaBookings, getMe, getStudioModalities, getTeachableModalities, saveSessionNote, getSessionNote, setBookingStatus } from "../../src";
import { enabled, isoDay, newClient, newStudio, newUser, type Person } from "./harness";

describe("bookings against a real Supabase", { skip: !enabled && "SUPABASE_TEST_* not set" }, () => {
  let studioId: string;
  let boss: Person;
  let pilates: string;
  let acupuncture: string;
  let anaInstructor: Person; // teaches pilates
  let bruInstructor: Person; // teaches acupuncture
  let clientP: string; // pilates client of ana
  let clientA: string; // acupuncture client of bru

  before(async () => {
    const s = await newStudio(["pilates", "acupuncture"]);
    studioId = s.studioId;
    boss = s.admin;
    pilates = s.modality.pilates;
    acupuncture = s.modality.acupuncture;
    anaInstructor = await newUser(studioId, "instructor", [pilates]);
    bruInstructor = await newUser(studioId, "instructor", [acupuncture]);
    clientP = await newClient(studioId, [{ modalityId: pilates, instructorId: anaInstructor.id }], "Paula Pilates");
    clientA = await newClient(studioId, [{ modalityId: acupuncture, instructorId: bruInstructor.id }], "Alice Acupuntura");
  });

  test("getMe returns the role; modalities follow the role", async () => {
    assert.equal((await getMe(boss.supabase))?.role, "admin");
    const ana = await getMe(anaInstructor.supabase);
    assert.equal(ana?.role, "instructor");
    assert.deepEqual((await getStudioModalities(anaInstructor.supabase)).map((m) => m.key).sort(), ["acupuncture", "pilates"]);
    assert.deepEqual((await getTeachableModalities(anaInstructor.supabase, ana!)).map((m) => m.key), ["pilates"]);
    assert.equal((await getTeachableModalities(boss.supabase, (await getMe(boss.supabase))!)).length, 2, "admins teach everything the studio offers");
  });

  test("an instructor books only in modalities they handle; the agenda is scoped the same way", async () => {
    const date = isoDay(1);
    assert.deepEqual(await createBooking(anaInstructor.supabase, { clientId: clientP, date, hour: 8, modalityId: pilates }), {});
    const refused = await createBooking(anaInstructor.supabase, { clientId: clientA, date, hour: 8, modalityId: acupuncture });
    assert.ok(refused.error, "Ana cannot book Bru's acupuncture client");

    const mine = await getAgendaBookings(anaInstructor.supabase, date, date);
    assert.deepEqual(mine.map((b) => b.name), ["Paula Pilates"]);
    assert.equal((await getAgendaBookings(boss.supabase, date, date)).length, 1);
  });

  test("the same client cannot be booked twice at the same time", async () => {
    const date = isoDay(2);
    assert.deepEqual(await createBooking(anaInstructor.supabase, { clientId: clientP, date, hour: 9, modalityId: pilates }), {});
    const again = await createBooking(anaInstructor.supabase, { clientId: clientP, date, hour: 9, modalityId: pilates });
    assert.equal(again.error, "Este cliente já está neste horário.");
  });

  test("attendance: reason is stored for a justified miss, cleared by any other status", async () => {
    const date = isoDay(3);
    await createBooking(anaInstructor.supabase, { clientId: clientP, date, hour: 10, modalityId: pilates });
    const [b] = await getAgendaBookings(anaInstructor.supabase, date, date);
    assert.deepEqual(await setBookingStatus(anaInstructor.supabase, b.id, "JUSTIFIED_MISS", "gripe"), {});
    let [after] = await getAgendaBookings(anaInstructor.supabase, date, date);
    assert.equal(after.status, "JUSTIFIED_MISS");
    assert.equal(after.missReason, "gripe");
    await setBookingStatus(anaInstructor.supabase, b.id, "PRESENCE_CONFIRMED");
    [after] = await getAgendaBookings(anaInstructor.supabase, date, date);
    assert.equal(after.missReason, null);
  });

  test("replacement lifecycle: links to the miss, can only be made once, and cannot change status", async () => {
    const missDate = isoDay(-2);
    await createBooking(boss.supabase, { clientId: clientP, date: missDate, hour: 11, modalityId: pilates });
    const [miss] = (await getAgendaBookings(boss.supabase, missDate, missDate)).filter((b) => b.clientId === clientP);
    await setBookingStatus(boss.supabase, miss.id, "JUSTIFIED_MISS", "viagem");

    const repDate = isoDay(4);
    assert.deepEqual(await createBooking(boss.supabase, { clientId: clientP, date: repDate, hour: 12, modalityId: pilates, replacesId: miss.id }), {});
    const [rep] = await getAgendaBookings(boss.supabase, repDate, repDate);
    assert.equal(rep.status, "REPLACEMENT");
    assert.equal(rep.replacesDate, missDate);

    const second = await createBooking(boss.supabase, { clientId: clientP, date: isoDay(5), hour: 12, modalityId: pilates, replacesId: miss.id });
    assert.equal(second.error, "Esta falta já foi reposta.");
    assert.ok((await setBookingStatus(boss.supabase, rep.id, "UNJUSTIFIED_MISS")).error, "a replacement keeps its status");
  });

  test("a labelled one-off has no modality; archived clients get no bookings", async () => {
    const date = isoDay(6);
    assert.deepEqual(await createBooking(boss.supabase, { clientId: clientP, date, hour: 14, label: "Aula experimental" }), {});
    const [b] = await getAgendaBookings(boss.supabase, date, date);
    assert.equal(b.modalityId, null);
    assert.equal(b.label, "Aula experimental");

    await boss.supabase.from("clients").update({ active: false }).eq("id", clientA);
    assert.equal((await createBooking(boss.supabase, { clientId: clientA, date, hour: 15, modalityId: acupuncture })).error, "Clientes arquivados não recebem novos agendamentos.");
  });

  test("class notes: save, read, replace, clear; another studio cannot read them", async () => {
    const date = isoDay(7);
    assert.deepEqual(await saveSessionNote(anaInstructor.supabase, studioId, date, 8, pilates, "turma cheia"), {});
    assert.equal(await getSessionNote(boss.supabase, date, 8, pilates), "turma cheia");
    await saveSessionNote(boss.supabase, studioId, date, 8, pilates, "trocar colchonete");
    assert.equal(await getSessionNote(anaInstructor.supabase, date, 8, pilates), "trocar colchonete");

    const other = await newStudio(["pilates"]);
    assert.equal(await getSessionNote(other.admin.supabase, date, 8, pilates), null, "isolated by studio");

    await saveSessionNote(boss.supabase, studioId, date, 8, pilates, "");
    assert.equal(await getSessionNote(boss.supabase, date, 8, pilates), null);
  });

  test("deleting a booking removes it; another studio cannot delete it", async () => {
    const date = isoDay(8);
    await createBooking(boss.supabase, { clientId: clientP, date, hour: 16, modalityId: pilates });
    const [b] = await getAgendaBookings(boss.supabase, date, date);
    const stranger = await newStudio(["pilates"]);
    assert.ok((await deleteBooking(stranger.admin.supabase, b.id)).error, "the stranger is told it did not happen");
    assert.equal((await getAgendaBookings(boss.supabase, date, date)).length, 1, "RLS hides it from the stranger, so nothing was deleted");
    assert.deepEqual(await deleteBooking(boss.supabase, b.id), {});
    assert.equal((await getAgendaBookings(boss.supabase, date, date)).length, 0);
  });
});
