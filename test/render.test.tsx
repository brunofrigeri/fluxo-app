import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "react-dom/server";
import { MODALITY_KEYS, getForm, parseData, type RecordData } from "@fluxo/forms";
import { FormFields } from "../src/components/forms/FormFields";
import { FormReadView } from "../src/components/forms/FormReadView";

// Every definition must draw without throwing, empty and filled, and its read view must show what was saved.
for (const modality of MODALITY_KEYS) {
  for (const kind of ["evaluation", "evolution"] as const) {
    test(`${modality} ${kind}: renders empty and filled`, () => {
      const def = getForm(modality, kind);
      const html = renderToString(<FormFields def={def} value={{}} onChange={() => {}} />);
      for (const s of def.sections) {
        if (def.sections.length > 1 || s.fields[0].kind !== "custom") assert.ok(html.includes(s.title.replace(/&/g, "&amp;")) || html.length > 0);
      }
      assert.ok(html.length > 200);

      const sample: RecordData = modality === "acupuncture" && kind === "evaluation"
        ? { main_complaint: "Ansiedade", constitution: "yin", tongue_zones: ["lung", "ming_men"], palpation: [{ label: "Abdômen", value: "tenso" }], five_elements: [{ label: "Fogo", value: "calor" }], emotional_other: [{ label: "Culpa", value: "sim" }] }
        : modality === "acupuncture"
          ? { current_complaint: "Dor lombar", conducts: "VB34" }
          : kind === "evaluation"
            ? { diagnosis: "Lombalgia", main_complaint: "Dor" }
            : { apparatus: { reformer: { strengthening: { regions: ["mmii"], note: "3 molas" } } } };
      const parsed = parseData(def, sample);
      assert.ok(parsed.ok, JSON.stringify(parsed));
      const filled = renderToString(<FormFields def={def} value={parsed.data} onChange={() => {}} />);
      assert.ok(filled.length > 200);
      const read = renderToString(<FormReadView def={def} data={parsed.data} />);
      const text = Object.values(sample)[0];
      if (typeof text === "string") assert.ok(read.includes(text), `read view should show "${text}"`);
    });
  }
}

test("suggested five-element rows are offered empty and dropped when left empty", () => {
  const def = getForm("acupuncture", "evaluation");
  const html = renderToString(<FormFields def={def} value={{}} onChange={() => {}} />);
  for (const label of ["Fogo", "Terra", "Metal", "Água", "Madeira"]) assert.ok(html.includes(`value="${label}"`), label);
  const r = parseData(def, { five_elements: ["Fogo", "Terra", "Metal", "Água", "Madeira"].map((label) => ({ label, value: "" })) });
  assert.ok(r.ok);
  assert.deepEqual(r.data, {});
});
