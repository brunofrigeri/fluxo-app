import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildCss } from "../src/css";
import { dark, icons, light } from "../src";

test("tokens.css is up to date (run `npm run generate -w @fluxo/tokens`)", () => {
  const committed = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  assert.equal(committed, buildCss());
});

test("light and dark define the same tokens", () => {
  assert.deepEqual(Object.keys(dark), Object.keys(light));
});

test("every color is a hex or rgba value", () => {
  for (const theme of [light, dark])
    for (const [k, v] of Object.entries(theme))
      if (!k.startsWith("shadow")) assert.match(v, /^(#[0-9A-Fa-f]{6}|rgba\([\d.,]+\))$/, k);
});

test("icons have paths and a stroke width", () => {
  for (const [name, i] of Object.entries(icons)) {
    assert.ok(i.paths.length > 0, name);
    assert.ok(i.strokeWidth > 0, name);
  }
});
