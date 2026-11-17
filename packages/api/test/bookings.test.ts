import assert from "node:assert/strict";
import { test } from "node:test";
import { createBooking, deleteBooking, friendly, saveSessionNote, setBookingStatus } from "../src";
import { op, stubClient } from "./stub";

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

test("a justified miss needs a reason, and sends it", async () => {
  const { client, calls } = stubClient();
  assert.deepEqual(await setBookingStatus(client, ID, "JUSTIFIED_MISS", "   "), { error: "Informe o motivo da falta (até 300 caracteres)." });
  assert.equal(calls.length, 0, "nothing is sent without a reason");
  assert.deepEqual(await setBookingStatus(client, ID, "JUSTIFIED_MISS", "  gripe "), {});
  assert.deepEqual(op(calls[0], "update"), [{ status: "JUSTIFIED_MISS", miss_reason: "gripe" }]);
});

test("any other status clears the reason, and unmarking is allowed", async () => {
  const { client, calls } = stubClient();
  await setBookingStatus(client, ID, "PRESENCE_CONFIRMED", "left over");
  assert.deepEqual(op(calls[0], "update"), [{ status: "PRESENCE_CONFIRMED", miss_reason: null }]);
  await setBookingStatus(client, ID, null);
  assert.deepEqual(op(calls[1], "update"), [{ status: null, miss_reason: null }]);
  assert.equal((await setBookingStatus(client, ID, "NOPE" as never)).error, "Status inválido.");
});

test("database refusals come back as friendly pt-BR messages", async () => {
  const { client } = stubClient(() => ({ error: { code: "23514", message: 'violates check constraint "bookings_check"' } }));
  assert.equal((await setBookingStatus(client, ID, "UNJUSTIFIED_MISS")).error, "Esta sessão é uma reposição e não pode mudar de status.");
  assert.equal(friendly({ code: "23505", message: "duplicate replaces_booking_id" }), "Esta falta já foi reposta.");
  assert.equal(friendly({ code: "42501", message: "x" }), "Você não tem acesso a esta modalidade deste cliente.");
});

test("a thrown network failure becomes a message instead of a crash", async () => {
  const { client } = stubClient(() => {
    throw new Error("Network request failed");
  });
  assert.deepEqual(await deleteBooking(client, ID), { error: "Network request failed" });
});

test("booking: modality or label, never both; one-offs cannot be replacements", async () => {
  const { client, calls } = stubClient(() => ({ data: { active: true } }));
  const base = { clientId: ID, date: "2026-10-05", hour: 7 };
  assert.equal((await createBooking(client, { ...base })).error, "Escolha a modalidade.");
  assert.equal((await createBooking(client, { ...base, modalityId: ID2, label: "Aula" })).error, "Escolha a modalidade.");
  assert.equal((await createBooking(client, { ...base, label: "Aula", replacesId: ID2 })).error, "Atividades avulsas não têm reposição.");
  assert.equal((await createBooking(client, { ...base, hour: 21, modalityId: ID2 })).error, "Horário inválido.");
  assert.equal(calls.length, 0);
});

test("booking: archived clients are refused; a replacement is created as REPLACEMENT pointing at the miss", async () => {
  const archived = stubClient(() => ({ data: { active: false } }));
  assert.equal((await createBooking(archived.client, { clientId: ID, date: "2026-10-05", hour: 7, modalityId: ID2 })).error, "Clientes arquivados não recebem novos agendamentos.");

  const ok = stubClient(() => ({ data: { active: true } }));
  const missId = "33333333-3333-4333-8333-333333333333";
  assert.deepEqual(await createBooking(ok.client, { clientId: ID, date: "2026-10-05", hour: 7, modalityId: ID2, replacesId: missId }), {});
  const insert = op(ok.calls[1], "insert")?.[0] as Record<string, unknown>;
  assert.equal(insert.status, "REPLACEMENT");
  assert.equal(insert.replaces_booking_id, missId);
  assert.equal(insert.start_time, "07:00");
  assert.equal(insert.label, null);
});

test("booking: a labelled one-off has no modality and no status", async () => {
  const ok = stubClient(() => ({ data: { active: true } }));
  await createBooking(ok.client, { clientId: ID, date: "2026-10-05", hour: 18, label: "  Aula experimental " });
  const insert = op(ok.calls[1], "insert")?.[0] as Record<string, unknown>;
  assert.deepEqual({ modality_id: insert.modality_id, label: insert.label, status: insert.status }, { modality_id: null, label: "Aula experimental", status: null });
});

test("class notes: empty deletes, text upserts into the studio, too long is refused", async () => {
  const a = stubClient();
  assert.deepEqual(await saveSessionNote(a.client, "studio-1", "2026-10-05", 7, ID, "   "), {});
  assert.ok(a.calls[0].ops.some(([n]) => n === "delete"));
  const b = stubClient();
  await saveSessionNote(b.client, "studio-1", "2026-10-05", 7, ID, " turma cheia ");
  const row = op(b.calls[0], "upsert")?.[0] as Record<string, unknown>;
  assert.equal(row.studio_id, "studio-1");
  assert.equal(row.note, "turma cheia");
  assert.equal((await saveSessionNote(b.client, "studio-1", "2026-10-05", 7, ID, "x".repeat(2001))).error, "Nota muito longa.");
  assert.equal((await saveSessionNote(b.client, null, "2026-10-05", 7, ID, "oi")).error, "Sessão expirada. Entre novamente.");
});

test("an update that touched no row is reported, not treated as success (RLS hides rows silently)", async () => {
  const { client } = stubClient(() => ({ data: [] }));
  const expected = "Não foi possível alterar: o registro não existe ou você não tem acesso a ele.";
  assert.equal((await setBookingStatus(client, ID, "PRESENCE_CONFIRMED")).error, expected);
  assert.equal((await deleteBooking(client, ID)).error, expected);
});
