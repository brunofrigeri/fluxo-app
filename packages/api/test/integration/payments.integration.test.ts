import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { getClientPayments, getMe, getOverduePayments, listDocuments, listPaymentCycles, registerClient, setPaymentStatus, uploadReceipt, NOT_ALLOWED, type ClientInput, type Me } from "../../src";
import { admin, enabled, newClient, newStudio, newUser, type Person } from "./harness";

const base = (over: Partial<ClientInput> = {}): ClientInput => ({
  document: `doc-${Math.random().toString(36).slice(2)}`, name: "Cliente Novo", email: null, phone: null, emergency_contact_name: null, emergency_contact_phone: null,
  date_of_birth: null, sex: null, marital_status: null, city: null, profession: null, workplace: null, children: null, parents: null, billing_day: 10, ...over,
});

// Every date is passed in, so the tests do not depend on the day they run.
const TODAY = "2026-03-15";

describe("payments against a real Supabase", { skip: !enabled && "SUPABASE_TEST_* not set" }, () => {
  let boss: Person, ana: Person, other: Person;
  let bossMe: Me;
  let pilates: string;
  let clientId: string;

  before(async () => {
    const s = await newStudio(["pilates"]);
    boss = s.admin;
    pilates = s.modality.pilates;
    ana = await newUser(s.studioId, "instructor", [pilates]);
    other = (await newStudio(["pilates"])).admin;
    bossMe = (await getMe(boss.supabase))!;
    clientId = await newClient(s.studioId, [{ modalityId: pilates, instructorId: ana.id }], "Maria Pagadora");
    // Billing began on 2026-01-01, due on the 10th: 01-10, 02-10 and 03-10 are past on TODAY.
    await admin().from("clients").update({ billing_day: 10 }).eq("id", clientId);
    await admin().from("clients").update({ billing_since: "2026-01-01" }).eq("id", clientId);
  });

  test("a client needs a payment day at onboarding, between 1 and 31", async () => {
    assert.equal((await registerClient(boss.supabase, bossMe, base({ billing_day: null }), [{ modalityId: pilates, instructorId: null }])).error, "Informe o dia do pagamento (de 1 a 31).");
    assert.equal((await registerClient(boss.supabase, bossMe, base({ billing_day: 32 }), [{ modalityId: pilates, instructorId: null }])).error, "Informe o dia do pagamento (de 1 a 31).");
    assert.equal((await registerClient(boss.supabase, bossMe, base({ billing_day: 2.5 }), [{ modalityId: pilates, instructorId: null }])).error, "Informe o dia do pagamento (de 1 a 31).");
    const ok = await registerClient(boss.supabase, bossMe, base({ billing_day: 31 }), [{ modalityId: pilates, instructorId: null }]);
    assert.ok(ok.id);
    const { data } = await boss.supabase.from("clients").select("billing_day, billing_since").eq("id", ok.id!).single();
    assert.equal(data?.billing_day, 31);
    assert.ok(data?.billing_since, "billing starts counting from registration");
  });

  test("due dates of a month, pending until recorded", async () => {
    const march = (await listPaymentCycles(boss.supabase, "2026-03-01", "2026-03-31", TODAY)).filter((c) => c.clientId === clientId);
    assert.deepEqual(march.map((c) => [c.dueDate, c.status, c.overdue]), [["2026-03-10", "pending", true]]);
    const upcoming = (await listPaymentCycles(boss.supabase, "2026-04-01", "2026-04-30", TODAY)).filter((c) => c.clientId === clientId);
    assert.deepEqual(upcoming.map((c) => [c.dueDate, c.overdue]), [["2026-04-10", false]]);
  });

  test("what nobody updated shows as overdue, oldest first, one line per client", async () => {
    const { items } = await getOverduePayments(boss.supabase, TODAY);
    const mine = items.find((i) => i.clientId === clientId)!;
    assert.equal(mine.count, 3);
    assert.equal(mine.dueDate, "2026-01-10");
    assert.equal(mine.unpaid, false);
  });

  test("marking paid removes it from the overdue list; 'não pago' keeps it, flagged; clearing brings it back", async () => {
    const count = async () => (await getOverduePayments(boss.supabase, TODAY)).items.find((i) => i.clientId === clientId)?.count ?? 0;
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-01-10", status: "paid", paidOn: "2026-01-09" }, TODAY), {});
    assert.equal(await count(), 2);
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-02-10", status: "unpaid" }, TODAY), {});
    assert.equal(await count(), 2, "an explicit 'não pago' is still owed");
    assert.equal((await getOverduePayments(boss.supabase, TODAY)).items.find((i) => i.clientId === clientId)?.unpaid, true);
    // Changing the mind is an update, not a duplicate.
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-02-10", status: "paid" }, TODAY), {});
    assert.equal(await count(), 1);
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-02-10", status: "pending" }, TODAY), {});
    assert.equal(await count(), 2);
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-02-10", status: "pending" }, TODAY), {}, "clearing twice is harmless");
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-02-10", status: "paid", paidOn: "2026-02-12" }, TODAY), {});
    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-03-10", status: "paid" }, TODAY), {});
    assert.equal(await count(), 0);
  });

  test("bad input is refused with a message", async () => {
    assert.equal((await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-04-11", status: "paid" }, TODAY)).error, "A data de vencimento não corresponde ao dia de pagamento do cliente.");
    assert.equal((await setPaymentStatus(boss.supabase, { clientId, dueDate: "nope", status: "paid" }, TODAY)).error, "Data de vencimento inválida.");
    assert.equal((await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-04-10", status: "paid", paidOn: "2026-03-16" }, TODAY)).error, "A data do pagamento não pode estar no futuro.");
  });

  test("the history lists the next due date and every recorded one, newest first", async () => {
    const { billingDay, payments } = await getClientPayments(boss.supabase, clientId, TODAY);
    assert.equal(billingDay, 10);
    assert.deepEqual(payments.map((p) => [p.dueDate, p.status]), [["2026-04-10", "pending"], ["2026-03-10", "paid"], ["2026-02-10", "paid"], ["2026-01-10", "paid"]]);
    assert.equal(payments.find((p) => p.dueDate === "2026-01-10")?.paidOn, "2026-01-09");
  });

  test("instructors and other studios neither see nor change payments", async () => {
    assert.deepEqual((await getOverduePayments(ana.supabase, TODAY)).items, []);
    assert.deepEqual(await listPaymentCycles(ana.supabase, "2026-03-01", "2026-03-31", TODAY), []);
    assert.ok((await setPaymentStatus(ana.supabase, { clientId, dueDate: "2026-04-10", status: "paid" }, TODAY)).error);
    assert.deepEqual((await listPaymentCycles(other.supabase, "2026-03-01", "2026-03-31", TODAY)).filter((c) => c.clientId === clientId), []);
    assert.ok((await setPaymentStatus(other.supabase, { clientId, dueDate: "2026-04-10", status: "paid" }, TODAY)).error);
    // Clearing a record they cannot see is reported, not silently "done".
    assert.equal((await setPaymentStatus(ana.supabase, { clientId, dueDate: "2026-03-10", status: "pending" }, TODAY)).error, NOT_ALLOWED);
    assert.equal((await setPaymentStatus(other.supabase, { clientId, dueDate: "2026-03-10", status: "pending" }, TODAY)).error, NOT_ALLOWED);
    assert.equal((await getClientPayments(boss.supabase, clientId, TODAY)).payments.find((p) => p.dueDate === "2026-03-10")?.status, "paid", "still paid");
  });

  test("receipts belong to a payment, are hidden from instructors, and go away with the record", async () => {
    const { payments } = await getClientPayments(boss.supabase, clientId, TODAY);
    const paymentId = payments.find((p) => p.dueDate === "2026-03-10")!.paymentId!;
    const body = new Uint8Array([37, 80, 68, 70]); // "%PDF"
    const up = { clientId, paymentId, body, fileName: "recibo.pdf", mimeType: "application/pdf", sizeBytes: body.length, label: "Recibo de março" };
    assert.deepEqual(await uploadReceipt(boss.supabase, up), {});

    const after = (await getClientPayments(boss.supabase, clientId, TODAY)).payments.find((p) => p.dueDate === "2026-03-10")!;
    assert.deepEqual(after.receipts.map((r) => r.name), ["Recibo de março"]);
    assert.deepEqual((await listDocuments(boss.supabase, clientId)).map((d) => d.name), [], "receipts are not listed with the client's own documents");
    assert.deepEqual((await getClientPayments(ana.supabase, clientId, TODAY)).payments, []);

    const a = admin();
    const { data: row } = await a.from("documents").select("storage_path").eq("payment_id", paymentId).single();
    const folder = `${clientId}/payments`;
    const listed = async () => (await a.storage.from("client-documents").list(folder)).data?.length ?? 0;
    assert.equal(await listed(), 1);
    assert.ok((row!.storage_path as string).startsWith(`${folder}/`));

    assert.ok((await uploadReceipt(ana.supabase, up)).error, "an instructor cannot attach a receipt");

    assert.deepEqual(await setPaymentStatus(boss.supabase, { clientId, dueDate: "2026-03-10", status: "pending" }, TODAY), {});
    assert.equal(await listed(), 0, "the file is removed with the record");
    const { count } = await a.from("documents").select("id", { count: "exact", head: true }).eq("client_id", clientId);
    assert.equal(count, 0);
  });
});
