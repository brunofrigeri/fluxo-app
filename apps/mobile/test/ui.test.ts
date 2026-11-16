import assert from "node:assert/strict";
import { test } from "node:test";
import { dark, light } from "@fluxo/tokens";
import { figtreeFamily } from "../src/ui/fonts";
import { statusColors } from "../src/ui/status";

test("CSS weights map to the nearest Figtree file, rounding up like a browser", () => {
  assert.equal(figtreeFamily(undefined), "Figtree_400Regular");
  assert.equal(figtreeFamily(400), "Figtree_400Regular");
  assert.equal(figtreeFamily(550), "Figtree_600SemiBold");
  assert.equal(figtreeFamily(600), "Figtree_600SemiBold");
  assert.equal(figtreeFamily(650), "Figtree_700Bold");
  assert.equal(figtreeFamily(700), "Figtree_700Bold");
});

test("status chips use the same tokens as the web", () => {
  assert.deepEqual(statusColors(light, "PRESENCE_CONFIRMED"), { bg: light.okBg, fg: light.okFg, dot: light.okDot });
  assert.deepEqual(statusColors(dark, "UNJUSTIFIED_MISS"), { bg: dark.umBg, fg: dark.umFg, dot: dark.umDot });
  assert.equal(statusColors(light, null).bg, light.stone);
});
