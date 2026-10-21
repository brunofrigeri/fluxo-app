import assert from "node:assert/strict";
import { test } from "node:test";
import { MODALITY_KEYS, editableData, getForm, isEmptyData, normalizeTree, parseData, readSections, summarize } from "../src/index";

test("every modality has an evaluation and an evolution definition with unique field keys", () => {
  for (const m of MODALITY_KEYS) {
    for (const kind of ["evaluation", "evolution"] as const) {
      const def = getForm(m, kind);
      assert.equal(def.modality, m);
      assert.equal(def.kind, kind);
      const keys = def.sections.flatMap((s) => s.fields.map((f) => f.key));
      assert.equal(new Set(keys).size, keys.length, `${m}/${kind} has duplicate keys`);
    }
  }
});

test("unknown keys are rejected", () => {
  const def = getForm("acupuncture", "evolution");
  const r = parseData(def, { conducts: "x", nope: "y" });
  assert.equal(r.ok, false);
});

test("empty values are dropped and text is trimmed", () => {
  const def = getForm("acupuncture", "evolution");
  const r = parseData(def, { conducts: "  agulhas  ", tongue: "", current_complaint: "   " });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { conducts: "agulhas" });
});

test("a choice outside the options is rejected", () => {
  const def = getForm("acupuncture", "evaluation");
  assert.equal(parseData(def, { constitution: "yin" }).ok, true);
  assert.equal(parseData(def, { constitution: "other" }).ok, false);
});

test("rows keep filled rows only and respect maxRows", () => {
  const def = getForm("acupuncture", "evaluation");
  const ok = parseData(def, { five_elements: [{ label: "Fogo", value: "calor" }, { label: "Terra", value: "" }, { label: "", value: "" }] });
  assert.ok(ok.ok);
  assert.deepEqual(ok.data.five_elements, [{ label: "Fogo", value: "calor" }]);
  const tooMany = parseData(def, { emotional_other: [{ label: "a", value: "b" }, { label: "c", value: "d" }] });
  assert.equal(tooMany.ok, false);
});

test("tongue zones are validated, deduped and ordered", () => {
  const def = getForm("acupuncture", "evaluation");
  const r = parseData(def, { tongue_zones: ["kidney", "lung", "kidney"] });
  assert.ok(r.ok);
  assert.deepEqual(r.data.tongue_zones, ["lung", "kidney"]);
  assert.equal(parseData(def, { tongue_zones: ["elbow"] }).ok, false);
  const empty = parseData(def, { tongue_zones: [] });
  assert.ok(empty.ok);
  assert.ok(isEmptyData(def, empty.data));
});

test("pilates evolution keeps the apparatus tree and drops empty branches", () => {
  const def = getForm("pilates", "evolution");
  const r = parseData(def, { apparatus: { reformer: { strengthening: { regions: ["mmii"], note: "3 molas" }, mobility: { regions: [] } } } });
  assert.ok(r.ok);
  assert.deepEqual(r.data, { apparatus: { reformer: { strengthening: { regions: ["mmii"], note: "3 molas" } } } });
  assert.equal(parseData(def, { apparatus: { reformer: { strengthening: { regions: ["wing"] } } } }).ok, false);
  assert.equal(parseData(def, { apparatus: { zeppelin: {} } }).ok, false);
  assert.ok(isEmptyData(def, { apparatus: {} }));
});

test("legacy apparatus rows (free text per area) are read as regions + note", () => {
  const tree = normalizeTree({ reformer: { strengthening: { inferiors: "pernas", superiors: "", global: "" } } });
  assert.deepEqual(tree, { reformer: { strengthening: { regions: ["mmii"], note: "pernas" } } });
});

test("summaries and read sections only show what was filled", () => {
  const evo = getForm("acupuncture", "evolution");
  assert.equal(summarize(evo, { current_complaint: "Dor lombar", conducts: "VB34" }).title, "Dor lombar");
  const ev = getForm("acupuncture", "evaluation");
  const sections = readSections(ev, { main_complaint: "Ansiedade", posture: "ereta" });
  assert.deepEqual(sections.map((s) => s.id), ["queixa", "corpo"]);
});

test("editableData normalizes legacy stored shapes instead of rejecting them", () => {
  const def = getForm("pilates", "evolution");
  const data = editableData(def, { apparatus: { reformer: { strengthening: { inferiors: "pernas" } } } });
  assert.deepEqual(data.apparatus, { reformer: { strengthening: { regions: ["mmii"], note: "pernas" } } });
  assert.equal(parseData(def, data).ok, true);
});
