import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import {
  countEvolutions, createBooking, deleteDocument, deleteEvaluation, deleteEvolution, getAgendaBookings, getDocumentUrl, getEvolution, getSessionOptions, listDocuments,
  listEvaluations, listEvolutions, saveEvaluation, saveEvolution, setBookingStatus, uploadDocument,
} from "../../src";
import { enabled, isoDay, newClient, newStudio, newUser, type Person } from "./harness";

const APPARATUS = { apparatus: { reformer: { strengthening: { regions: ["mmii"], note: "Séries de 10" } } } };

describe("records and documents against a real Supabase", { skip: !enabled && "SUPABASE_TEST_* not set" }, () => {
  let boss: Person, ana: Person, bru: Person, stranger: Person;
  let pilates: string, acupuncture: string;
  let clientP: string, clientA: string;

  before(async () => {
    const s = await newStudio(["pilates", "acupuncture"]);
    boss = s.admin;
    pilates = s.modality.pilates;
    acupuncture = s.modality.acupuncture;
    ana = await newUser(s.studioId, "instructor", [pilates]);
    bru = await newUser(s.studioId, "instructor", [acupuncture]);
    clientP = await newClient(s.studioId, [{ modalityId: pilates, instructorId: ana.id }], "Paula");
    clientA = await newClient(s.studioId, [{ modalityId: acupuncture, instructorId: bru.id }], "Alice");
    stranger = (await newStudio(["pilates"])).admin;
  });

  async function presentSession(daysAgo: number, hour: number): Promise<string> {
    const date = isoDay(-daysAgo);
    await createBooking(boss.supabase, { clientId: clientP, date, hour, modalityId: pilates });
    const b = (await getAgendaBookings(boss.supabase, date, date)).find((x) => x.clientId === clientP && x.hour === hour)!;
    assert.deepEqual(await setBookingStatus(boss.supabase, b.id, "PRESENCE_CONFIRMED"), {});
    return b.id;
  }

  test("an evolution needs a present session; it is linked once and the next number follows the count", async () => {
    const sessionId = await presentSession(1, 8);
    const options = await getSessionOptions(ana.supabase, clientP, pilates);
    assert.ok(options.some((o) => o.id === sessionId && o.label.includes("Presença confirmada")));

    const saved = await saveEvolution(ana.supabase, { clientId: clientP, modality: "pilates", evolutionId: null, date: isoDay(-1), bookingId: sessionId, sessionNumber: 1, data: APPARATUS });
    assert.ok(saved.id, saved.error);
    assert.equal(await countEvolutions(ana.supabase, clientP, pilates), 1);
    assert.ok(!(await getSessionOptions(ana.supabase, clientP, pilates)).some((o) => o.id === sessionId), "a session with an evolution is not offered again");
    assert.ok((await getSessionOptions(ana.supabase, clientP, pilates, sessionId)).some((o) => o.id === sessionId), "...except when editing that very evolution");

    const missed = await createBooking(boss.supabase, { clientId: clientP, date: isoDay(-3), hour: 9, modalityId: pilates });
    assert.deepEqual(missed, {});
    const miss = (await getAgendaBookings(boss.supabase, isoDay(-3), isoDay(-3)))[0];
    await setBookingStatus(boss.supabase, miss.id, "UNJUSTIFIED_MISS");
    const refused = await saveEvolution(ana.supabase, { clientId: clientP, modality: "pilates", evolutionId: null, date: isoDay(-3), bookingId: miss.id, sessionNumber: 2, data: APPARATUS });
    assert.ok(refused.error, "the database refuses an evolution for a session the client missed");
  });

  test("validation: date, session number, modality, empty content, unknown keys", async () => {
    const ok = { clientId: clientP, modality: "pilates", evolutionId: null, date: isoDay(0), bookingId: null, sessionNumber: 1, data: APPARATUS };
    assert.equal((await saveEvolution(ana.supabase, { ...ok, date: "05/10" })).error, "Informe a data.");
    assert.equal((await saveEvolution(ana.supabase, { ...ok, sessionNumber: 0 })).error, "Informe o número da sessão.");
    assert.equal((await saveEvolution(ana.supabase, { ...ok, modality: "yoga" })).error, "Modalidade inválida.");
    assert.equal((await saveEvolution(ana.supabase, { ...ok, data: {} })).error, "Preencha ao menos um campo da evolução.");
    assert.ok((await saveEvolution(ana.supabase, { ...ok, data: { ...APPARATUS, surprise: "x" } })).error, "unknown keys are rejected");
  });

  test("edit and delete an evolution; list shows a summary; another studio cannot touch it", async () => {
    const created = await saveEvolution(boss.supabase, { clientId: clientP, modality: "pilates", evolutionId: null, date: isoDay(0), bookingId: null, sessionNumber: 7, data: APPARATUS });
    const id = created.id!;
    const rec = await getEvolution(boss.supabase, clientP, id);
    assert.equal(rec?.sessionNumber, 7);
    assert.equal(rec?.modality, "pilates");

    const edited = await saveEvolution(boss.supabase, { clientId: clientP, modality: "pilates", evolutionId: id, date: isoDay(0), bookingId: null, sessionNumber: 8, data: APPARATUS });
    assert.equal(edited.id, id);
    assert.equal((await getEvolution(boss.supabase, clientP, id))?.sessionNumber, 8);

    const list = await listEvolutions(boss.supabase, clientP, {});
    assert.ok(list.total >= 2);
    assert.ok(list.items.some((i) => i.id === id && i.title.length > 0));

    assert.ok((await deleteEvolution(stranger.supabase, clientP, id)).error, "told it did not happen");
    assert.ok((await saveEvolution(stranger.supabase, { clientId: clientP, modality: "pilates", evolutionId: id, date: isoDay(0), bookingId: null, sessionNumber: 1, data: APPARATUS })).error, "nor edit it");
    assert.deepEqual(await deleteEvolution(boss.supabase, clientP, id), {});
    assert.equal(await getEvolution(boss.supabase, clientP, id), null);
  });

  test("an instructor cannot record in a modality they do not handle", async () => {
    const r = await saveEvolution(ana.supabase, { clientId: clientA, modality: "acupuncture", evolutionId: null, date: isoDay(0), bookingId: null, sessionNumber: 1, data: { observations: "x" } });
    assert.ok(r.error, "Ana has no access to Alice's acupuncture record");
  });

  test("evaluations: first is the initial one, later ones are re-evaluations; edit and delete", async () => {
    const data = { main_complaint: "Dor lombar", diagnosis: "Lombalgia" };
    assert.deepEqual(await saveEvaluation(ana.supabase, { clientId: clientP, modality: "pilates", evaluationId: null, date: isoDay(-10), data }), {});
    assert.deepEqual(await saveEvaluation(ana.supabase, { clientId: clientP, modality: "pilates", evaluationId: null, date: isoDay(-1), data: { ...data, obs: "Melhora" } }), {});
    let list = await listEvaluations(ana.supabase, clientP);
    assert.deepEqual(list.map((e) => e.title), ["Reavaliação", "Avaliação inicial"], "newest first; the oldest is the initial evaluation");
    assert.equal(list[1].text, "Dor lombar");

    assert.deepEqual(await saveEvaluation(ana.supabase, { clientId: clientP, modality: "pilates", evaluationId: list[0].id, date: isoDay(-1), data: { ...data, obs: "Melhora clara" } }), {});
    list = await listEvaluations(ana.supabase, clientP);
    assert.equal((list[0].data as { obs?: string }).obs, "Melhora clara");
    assert.deepEqual(await deleteEvaluation(ana.supabase, clientP, list[0].id), {});
    assert.equal((await listEvaluations(ana.supabase, clientP)).length, 1);
    assert.ok((await saveEvaluation(ana.supabase, { clientId: clientP, modality: "pilates", evaluationId: null, date: "x", data })).error);
  });

  test("documents: upload, list, signed url, delete; wrong type and size are refused; strangers get nothing", async () => {
    const body = new TextEncoder().encode("%PDF-1.4 fake");
    const up = { clientId: clientP, body, fileName: "exame.pdf", mimeType: "application/pdf", sizeBytes: body.byteLength, label: " Exame de sangue " };
    assert.deepEqual(await uploadDocument(ana.supabase, up), {});
    const docs = await listDocuments(ana.supabase, clientP);
    assert.equal(docs.length, 1);
    assert.equal(docs[0].name, "Exame de sangue");

    const { url, error } = await getDocumentUrl(ana.supabase, clientP, docs[0].id);
    assert.ok(url && !error);
    const res = await fetch(url!);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /%PDF-1.4/);

    assert.equal((await uploadDocument(ana.supabase, { ...up, mimeType: "application/zip" })).error, "Formato não suportado. Envie PDF, JPG, PNG ou HEIC.");
    assert.equal((await uploadDocument(ana.supabase, { ...up, sizeBytes: 11 * 1024 * 1024 })).error, "O arquivo deve ter até 10MB.");
    assert.equal((await uploadDocument(ana.supabase, { ...up, sizeBytes: 0 })).error, "Escolha um arquivo.");

    assert.deepEqual(await listDocuments(stranger.supabase, clientP), []);
    assert.equal((await getDocumentUrl(stranger.supabase, clientP, docs[0].id)).url, undefined);
    assert.ok((await deleteDocument(stranger.supabase, clientP, docs[0].id)).error);

    assert.deepEqual(await deleteDocument(ana.supabase, clientP, docs[0].id), {});
    assert.deepEqual(await listDocuments(ana.supabase, clientP), []);
  });

  test("an instructor of another modality cannot upload for the client", async () => {
    const body = new TextEncoder().encode("x");
    const r = await uploadDocument(bru.supabase, { clientId: clientP, body, fileName: "a.pdf", mimeType: "application/pdf", sizeBytes: 1 });
    assert.ok(r.error, "Bru handles only acupuncture; Paula is pilates");
  });
});
