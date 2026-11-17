import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { getMe, getStudioModalities, listUsers, setStudioModality, updateUser, type Me } from "../../src";
import { enabled, newClient, newStudio, newUser, type Person } from "./harness";

describe("admin features against a real Supabase", { skip: !enabled && "SUPABASE_TEST_* not set" }, () => {
  let boss: Person, ana: Person;
  let bossMe: Me, anaMe: Me;
  let pilates: string, acupuncture: string;

  before(async () => {
    const s = await newStudio(["pilates"]);
    boss = s.admin;
    pilates = s.modality.pilates;
    acupuncture = s.modality.acupuncture;
    ana = await newUser(s.studioId, "instructor", [pilates]);
    bossMe = (await getMe(boss.supabase))!;
    anaMe = (await getMe(ana.supabase))!;
  });

  test("only admins switch modalities; switching on twice is harmless", async () => {
    assert.equal((await setStudioModality(ana.supabase, anaMe, acupuncture, true)).error, "Apenas administradores alteram as modalidades do estúdio.");
    assert.equal((await setStudioModality(boss.supabase, bossMe, "nope", true)).error, "Modalidade inválida.");
    assert.deepEqual(await setStudioModality(boss.supabase, bossMe, acupuncture, true), {});
    assert.deepEqual(await setStudioModality(boss.supabase, bossMe, acupuncture, true), {});
    assert.deepEqual((await getStudioModalities(boss.supabase)).map((m) => m.key).sort(), ["acupuncture", "pilates"]);
    assert.deepEqual(await setStudioModality(boss.supabase, bossMe, acupuncture, false), {});
    assert.deepEqual((await getStudioModalities(boss.supabase)).map((m) => m.key), ["pilates"]);
  });

  test("a modality with enrolled clients cannot be switched off (the database refuses)", async () => {
    await newClient(boss.studioId, [{ modalityId: pilates, instructorId: ana.id }]);
    const r = await setStudioModality(boss.supabase, bossMe, pilates, false);
    assert.ok(r.error, "refused while a client is enrolled");
    assert.ok((await getStudioModalities(boss.supabase)).some((m) => m.id === pilates), "still on");
  });

  test("the user list shows who teaches what; only admins see everyone", async () => {
    const all = await listUsers(boss.supabase);
    assert.deepEqual(all.map((u) => u.id).sort(), [boss.id, ana.id].sort());
    assert.deepEqual(all.find((u) => u.id === ana.id)?.modalityIds, [pilates]);
    assert.equal(all.find((u) => u.id === boss.id)?.role, "admin");
    assert.deepEqual((await listUsers(ana.supabase)).map((u) => u.id), [ana.id], "an instructor only sees themselves");
  });

  test("editing a user: validation, and a modality cannot be dropped while they own clients in it", async () => {
    const edit = (over: Partial<{ name: string; role: string; workingHours: string | null; modalityIds: string[] }>) => updateUser(boss.supabase, bossMe, ana.id, { name: "Ana Lima", role: "instructor", workingHours: "Seg a Sex", modalityIds: [pilates], ...over });
    assert.equal((await edit({ name: "A" })).error, "Informe o nome.");
    assert.equal((await edit({ role: "boss" })).error, "Escolha um papel.");
    assert.equal((await edit({ modalityIds: [] })).error, "Escolha ao menos uma modalidade que o instrutor ensina.");
    assert.equal((await edit({ modalityIds: ["00000000-0000-4000-8000-000000000000"] })).error, "Modalidade inválida.");
    assert.match((await edit({ modalityIds: [], role: "admin" })).error ?? "", /responsável por 1 cliente nessa modalidade/);

    assert.deepEqual(await edit({}), {});
    const ana2 = (await listUsers(boss.supabase)).find((u) => u.id === ana.id)!;
    assert.equal(ana2.name, "Ana Lima");
    assert.equal(ana2.workingHours, "Seg a Sex");
    assert.equal((await updateUser(ana.supabase, anaMe, ana.id, { name: "Hack", role: "admin", workingHours: null, modalityIds: [pilates] })).error, "Apenas administradores podem gerenciar usuários.");
  });

  test("an admin who becomes an instructor keeps exactly the modalities ticked", async () => {
    const other = await newUser(boss.studioId, "admin", []);
    assert.deepEqual(await updateUser(boss.supabase, bossMe, other.id, { name: "Outro Admin", role: "admin", workingHours: null, modalityIds: [] }), {});
    assert.deepEqual((await listUsers(boss.supabase)).find((u) => u.id === other.id)?.modalityIds, []);
  });
});
