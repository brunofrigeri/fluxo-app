import assert from "node:assert/strict";
import { test } from "node:test";
import { monthName, periodLabels, roleLabels, statusLabels, weekdayName, weekdayShort } from "../src";

test("calendar names are complete", () => {
  assert.equal(weekdayName.length, 7);
  assert.equal(weekdayShort.length, 7);
  assert.equal(monthName.length, 12);
});

test("no label is empty", () => {
  for (const group of [statusLabels, periodLabels, roleLabels])
    for (const [k, v] of Object.entries(group)) assert.ok(v.trim().length > 0, k);
});
