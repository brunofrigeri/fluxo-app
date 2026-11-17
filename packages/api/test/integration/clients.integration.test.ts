import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { addRecurringSlot, createBooking, getAgendaBookings, getClientDetail, getMe, listClients, registerClient, removeRecurringSlot, setArchived, updateClient, type ClientInput, type Me } from "../../src";
import { enabled, isoDay, newStudio, newUser, type Person } from "./harness";

const base = (over: Partial<ClientInput> = {}): ClientInput => ({
  document: `doc-${Math.random().toString(36).slice(2)}`, name: "Cliente Novo", email: null, phone: null, emergency_contact_name: null, emergency_contact_phone: null,
  date_of_birth: null, sex: null, marital_status: null, city: null, profession: null, workplace: null, children: null, parents: null, billing_day: 10, ...over,
});
const lists = { diseases: [], surgeries: [], current_treatments: [], previous_treatments: [], medications: [] };

describe("clients against a real Supabase", { skip: !enabled && "SUPABASE_TEST_* not set" }, () => {
  let boss: Person, ana: Person, bru: Person;
  let bossMe: Me, anaMe: Me;
  let pilates: string, acupuncture: string;

  before(async () => {
    const s = await newStudio(["pilates", "acupuncture"]);
    boss = s.admin;
    pilates = s.modality.pilates;
    acupuncture = s.modality.acupuncture;
    ana = await newUser(s.studioId, "instructor", [pilates]);
    bru = await newUser(s.studioId, "instructor", [acupuncture]);
    bossMe = (await getMe(boss.supabase))!;
    anaMe = (await getMe(ana.supabase))!;
  });

  test("an instructor enrolling a client becomes the responsible one, only in modalities they teach", async () => {
    const r = await registerClient(ana.supabase, anaMe, base({ name: "Da Ana" }), [{ modalityId: pilates, instructorId: bru.id }]);
    assert.ok(r.id);
    assert.deepEqual(r.modalityKeys, ["pilates"]);
    const detail = await getClientDetail(ana.supabase, r.id!);
    assert.equal(detail?.enrollment[0].instructorId, ana.id, "the instructor chosen in the input is ignored");

    const refused = await registerClient(ana.supabase, anaMe, base(), [{ modalityId: acupuncture, instructorId: null }]);
    assert.equal(refused.error, "Modalidade inválida.");
  });

  test("an admin picks the instructor; no modality is refused; a bad e-mail is refused; nothing is left half-created", async () => {
    const r = await registerClient(boss.supabase, bossMe, base({ name: "Do Chefe" }), [{ modalityId: acupuncture, instructorId: bru.id }]);
    assert.deepEqual(r.modalityKeys, ["acupuncture"]);
    assert.equal((await getClientDetail(boss.supabase, r.id!))?.enrollment[0].instructorId, bru.id);
    assert.equal((await registerClient(boss.supabase, bossMe, base(), [])).error, "Escolha ao menos uma modalidade.");
    assert.equal((await registerClient(boss.supabase, bossMe, base({ email: "nope" }), [{ modalityId: pilates, instructorId: null }])).error, "E-mail inválido.");
    assert.equal((await registerClient(boss.supabase, bossMe, base(), [{ modalityId: pilates, instructorId: "not-a-uuid" }])).error, "Instrutor inválido.");
  });

  test("two clients cannot share a document", async () => {
    const doc = `dup-${Date.now()}`;
    assert.ok((await registerClient(boss.supabase, bossMe, base({ document: doc }), [{ modalityId: pilates, instructorId: ana.id }])).id);
    const again = await registerClient(boss.supabase, bossMe, base({ document: doc }), [{ modalityId: pilates, instructorId: ana.id }]);
    assert.equal(again.error, "Já existe um cliente com este documento.");
  });

  test("an instructor lists only their clients; search and pagination work", async () => {
    const s = await newStudio(["pilates"]);
    const owner = (await getMe(s.admin.supabase))!;
    for (let i = 1; i <= 12; i++) await registerClient(s.admin.supabase, owner, base({ name: `Pessoa ${String(i).padStart(2, "0")}`, document: `p-${s.studioId}-${i}` }), [{ modalityId: s.modality.pilates, instructorId: null }]);
    const p1 = await listClients(s.admin.supabase, {});
    assert.equal(p1.total, 12);
    assert.equal(p1.items.length, 10);
    assert.equal(p1.lastPage, 2);
    assert.equal((await listClients(s.admin.supabase, { page: 2 })).items.length, 2);
    assert.deepEqual((await listClients(s.admin.supabase, { q: "Pessoa 07" })).items.map((c) => c.name), ["Pessoa 07"]);
    assert.equal((await listClients(s.admin.supabase, { q: "%,()*" })).total, 12, "filter characters are neutralised, not injected");

    const mine = await listClients(ana.supabase, {});
    assert.ok(mine.items.length > 0 && mine.items.every((c) => c.modalityIds.includes(pilates)));
    assert.ok(!mine.items.some((c) => c.name === "Do Chefe"), "Ana does not see the acupuncture client");
  });

  test("admins reassign the instructor and modalities; instructors cannot", async () => {
    const r = await registerClient(boss.supabase, bossMe, base({ name: "Reatribuir" }), [{ modalityId: pilates, instructorId: ana.id }]);
    const id = r.id!;
    assert.deepEqual(await updateClient(boss.supabase, bossMe, id, base({ name: "Reatribuir 2", document: "r-" + id }), lists, [{ modalityId: pilates, instructorId: null }, { modalityId: acupuncture, instructorId: bru.id }]), {});
    let d = await getClientDetail(boss.supabase, id);
    assert.equal(d?.client.name, "Reatribuir 2");
    assert.deepEqual(d?.enrollment.map((e) => e.modalityId).sort(), [acupuncture, pilates].sort());
    assert.equal(d?.enrollment.find((e) => e.modalityId === pilates)?.instructorId, null);

    // Nobody is responsible in pilates now, so Ana no longer sees the client: her save must say so, not pretend.
    assert.equal((await updateClient(ana.supabase, anaMe, id, base({ name: "Nao deve salvar", document: "r-" + id }), lists)).error, "Não foi possível alterar: o registro não existe ou você não tem acesso a ele.");
    assert.equal((await getClientDetail(boss.supabase, id))?.client.name, "Reatribuir 2");

    // Make Ana responsible again: she can edit, list entries are cleaned, and she can never reassign.
    await updateClient(boss.supabase, bossMe, id, base({ name: "Reatribuir 2", document: "r-" + id }), lists, [{ modalityId: pilates, instructorId: ana.id }]);
    assert.deepEqual(await updateClient(ana.supabase, anaMe, id, base({ name: "Reatribuir 3", document: "r-" + id }), { ...lists, diseases: ["  Asma ", ""] }, [{ modalityId: pilates, instructorId: bru.id }]), {});
    d = await getClientDetail(boss.supabase, id);
    assert.equal(d?.client.name, "Reatribuir 3");
    assert.deepEqual(d?.client.diseases, ["Asma"], "list entries are trimmed and blanks dropped");
    assert.equal(d?.enrollment.find((e) => e.modalityId === pilates)?.instructorId, ana.id, "an instructor cannot reassign");

    assert.equal((await updateClient(boss.supabase, bossMe, id, base({ document: "r-" + id }), lists, [])).error, "Escolha ao menos uma modalidade.");
  });

  test("recurring slots generate bookings; removing one clears the unmarked future; archiving does the same", async () => {
    const r = await registerClient(boss.supabase, bossMe, base({ name: "Rotina" }), [{ modalityId: pilates, instructorId: ana.id }]);
    const id = r.id!;
    const weekday = new Date(`${isoDay(3)}T12:00:00Z`).getUTCDay();
    assert.deepEqual(await addRecurringSlot(boss.supabase, id, { weekday, hour: 9, modalityId: pilates }), {});
    let d = await getClientDetail(boss.supabase, id);
    assert.equal(d?.slots.length, 1);
    assert.equal(d?.slots[0].hour, 9);
    const future = (await getAgendaBookings(boss.supabase, isoDay(0), isoDay(40))).filter((b) => b.clientId === id);
    assert.ok(future.length >= 4, "generate_bookings created the coming weeks");

    assert.deepEqual(await removeRecurringSlot(boss.supabase, d!.slots[0].id), {});
    assert.equal((await getAgendaBookings(boss.supabase, isoDay(0), isoDay(40))).filter((b) => b.clientId === id).length, 0);

    await createBooking(boss.supabase, { clientId: id, date: isoDay(2), hour: 10, modalityId: pilates });
    assert.deepEqual(await setArchived(boss.supabase, id, true), {});
    assert.equal((await getClientDetail(boss.supabase, id))?.client.active, false);
    assert.equal((await getAgendaBookings(boss.supabase, isoDay(0), isoDay(40))).filter((b) => b.clientId === id).length, 0, "unmarked future sessions leave the agenda");
    assert.deepEqual((await listClients(boss.supabase, { situation: "arquivados" })).items.filter((c) => c.id === id).map((c) => c.active), [false]);
    assert.deepEqual(await setArchived(boss.supabase, id, false), {});
    assert.equal((await getClientDetail(boss.supabase, id))?.client.active, true);
  });

  test("another studio cannot read the client at all", async () => {
    const r = await registerClient(boss.supabase, bossMe, base({ name: "Privado" }), [{ modalityId: pilates, instructorId: null }]);
    const stranger = await newStudio(["pilates"]);
    assert.equal(await getClientDetail(stranger.admin.supabase, r.id!), null);
  });
});
