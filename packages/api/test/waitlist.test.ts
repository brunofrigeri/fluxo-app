import assert from "node:assert/strict";
import { test } from "node:test";
import { addToWaitList, removeFromWaitList, updateWaitEntry } from "../src";
import { op, stubClient, type Call } from "./stub";

const MOD = "11111111-1111-4111-8111-111111111111";
const valid = { name: "  Maria Souza ", phone: "(11) 90000-0000", period: "MORNING", modalityId: MOD };

/** modalities + studio_modalities tables answer, so the studio "offers" MOD. */
const respond = (call: Call) => {
  if (call.table === "modalities") return { data: [{ id: MOD, key: "pilates", name_pt: "Pilates" }] };
  if (call.table === "studio_modalities") return { data: [{ modality_id: MOD }] };
  return { data: [{ id: "w1" }] };
};

test("validation messages come from the shared schema, and nothing is sent when it fails", async () => {
  const { client, calls } = stubClient(respond);
  assert.equal((await addToWaitList(client, "s1", { ...valid, name: "A" })).error, "Informe o nome.");
  assert.equal((await addToWaitList(client, "s1", { ...valid, phone: "123" })).error, "Informe um telefone válido.");
  assert.equal((await addToWaitList(client, "s1", { ...valid, period: "DAWN" })).error, "Escolha o período.");
  assert.equal(calls.filter((c) => c.table === "wait_list").length, 0);
});

test("a modality the studio has not switched on is refused", async () => {
  const { client } = stubClient((c) => (c.table === "studio_modalities" ? { data: [] } : respond(c)));
  assert.equal((await addToWaitList(client, "s1", valid)).error, "Modalidade inválida.");
});

test("adding inserts into the studio; updating and removing target the entry", async () => {
  const a = stubClient(respond);
  assert.deepEqual(await addToWaitList(a.client, "studio-1", valid), {});
  const insert = op(a.calls.find((c) => c.table === "wait_list")!, "insert")?.[0] as Record<string, unknown>;
  assert.deepEqual(insert, { name: "Maria Souza", phone: "(11) 90000-0000", period: "MORNING", modality_id: MOD, studio_id: "studio-1" });
  assert.equal((await addToWaitList(a.client, null, valid)).error, "Sessão expirada. Entre novamente.");

  const u = stubClient(respond);
  assert.deepEqual(await updateWaitEntry(u.client, "w1", valid), {});
  assert.deepEqual(op(u.calls.find((c) => c.table === "wait_list")!, "eq"), ["id", "w1"]);

  const r = stubClient();
  assert.deepEqual(await removeFromWaitList(r.client, "w1"), {});
  assert.ok(r.calls[0].ops.some(([n]) => n === "delete"));
});
