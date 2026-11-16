import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { addToWaitList, getWaitList, removeFromWaitList, updateWaitEntry } from "../../src";
import { admin, enabled, newStudio, type Person } from "./harness";

describe("wait list against a real Supabase", { skip: !enabled && "SUPABASE_TEST_* not set" }, () => {
  let boss: Person;
  let pilates: string;
  let acupuncture: string;

  before(async () => {
    const s = await newStudio(["pilates", "acupuncture"]);
    boss = s.admin;
    pilates = s.modality.pilates;
    acupuncture = s.modality.acupuncture;
  });

  test("first in, first listed; edit and remove", async () => {
    const mk = (name: string, modalityId: string) => ({ name, phone: "(11) 90000-0000", period: "NIGHT", modalityId });
    assert.deepEqual(await addToWaitList(boss.supabase, boss.studioId, mk("Primeira Pessoa", pilates)), {});
    assert.deepEqual(await addToWaitList(boss.supabase, boss.studioId, mk("Segunda Pessoa", pilates)), {});
    let list = await getWaitList(boss.supabase);
    assert.deepEqual(list.map((e) => e.name), ["Primeira Pessoa", "Segunda Pessoa"]);

    assert.deepEqual(await updateWaitEntry(boss.supabase, list[0].id, { ...mk("Primeira Editada", pilates), period: "MORNING" }), {});
    list = await getWaitList(boss.supabase);
    assert.equal(list[0].name, "Primeira Editada");
    assert.equal(list[0].period, "MORNING");

    assert.deepEqual(await removeFromWaitList(boss.supabase, list[0].id), {});
    assert.deepEqual((await getWaitList(boss.supabase)).map((e) => e.name), ["Segunda Pessoa"]);
  });

  test("entries of a modality that is switched off are hidden, and come back when it is switched on", async () => {
    await addToWaitList(boss.supabase, boss.studioId, { name: "Pessoa Acupuntura", phone: "(11) 90000-0000", period: "AFTERNOON", modalityId: acupuncture });
    assert.ok((await getWaitList(boss.supabase)).some((e) => e.name === "Pessoa Acupuntura"));
    await admin().from("studio_modalities").delete().eq("studio_id", boss.studioId).eq("modality_id", acupuncture);
    assert.ok(!(await getWaitList(boss.supabase)).some((e) => e.name === "Pessoa Acupuntura"));
    assert.equal((await addToWaitList(boss.supabase, boss.studioId, { name: "Outra Pessoa", phone: "(11) 90000-0000", period: "NIGHT", modalityId: acupuncture })).error, "Modalidade inválida.");
    await admin().from("studio_modalities").insert({ studio_id: boss.studioId, modality_id: acupuncture });
    assert.ok((await getWaitList(boss.supabase)).some((e) => e.name === "Pessoa Acupuntura"));
  });

  test("another studio never sees the list", async () => {
    const other = await newStudio(["pilates"]);
    assert.deepEqual(await getWaitList(other.admin.supabase), []);
  });
});
